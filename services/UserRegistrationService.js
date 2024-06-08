const Promise = require("bluebird");
const errors = require("../errors");
const LoginUtility = require("../db/utilities/LoginUtility");
const PlayerUtility = require("../db/utilities/PlayerUtility");
const ClubAcademyUtility = require("../db/utilities/ClubAcademyUtility");
const UserService = require("./UserService");
const uuid = require("uuid/v4");
const AuthUtility = require("../db/utilities/AuthUtility");
const EmailService = require("./EmailService");
const config = require("../config");
const _ = require("lodash");
const AdminUtility = require("../db/utilities/AdminUtility");
const ACCOUNT = require("../constants/AccountStatus");
const MEMBER = require("../constants/MemberType");
const ROLE = require("../constants/Role");
const PROFILE = require("../constants/ProfileStatus");
const RESPONSE_MESSAGE = require("../constants/ResponseMessage");
const redisServiceInst = require("../redis/RedisService");
const FootPlayerUtility = require("../db/utilities/FootPlayerUtility");
const FOOTPLAYER_STATUS = require("../constants/FootPlayerStatus");
const moment = require("moment");
const PLAYER_TYPE = require("../constants/PlayerType");
const {
  EmailClient,
  KnownEmailSendStatus,
} = require("@azure/communication-email");
const axios = require("axios");
/**
 *
 *
 * @class UserRegistrationService
 * @extends {UserService}
 */
class UserRegistrationService extends UserService {
  /**
   *Creates an instance of UserRegistrationService.
   * @memberof UserRegistrationService
   */
  constructor() {
    super();
    this.playerUtilityInst = new PlayerUtility();
    this.clubAcademyUtilityInst = new ClubAcademyUtility();
    this.loginUtilityInst = new LoginUtility();
    this.authUtilityInst = new AuthUtility();
    this.emailService = new EmailService();
    this.adminUtilityInst = new AdminUtility();
    this.footPlayerUtilityInst = new FootPlayerUtility();
  }
  connectionString =
    "endpoint=https://mycsr.unitedstates.communication.azure.com/;accesskey=hSLMNiZDd0wogPYNdT9tpLeqeWAO20/WMMcgjTCalrtIKKgLq+J66RHYPqvd8lK3Us9jfUKZzaySrUuplKohWw==";
  senderAddress =
    "DoNotReply@a1b588b6-9f22-4e0e-bbba-0f3fdd2d88f6.azurecomm.net";
  ecipientAddress = "yusufsaif0@gmail.com";

  /**
   *
   *
   * @param {*} registerUser
   * @returns
   * @memberof UserRegistrationService
   */
  async validateMemberRegistration(registerUser) {
    if (
      registerUser.member_type == MEMBER.PLAYER ||
      registerUser.member_type == MEMBER.coache
    ) {
      if (!registerUser.first_name) {
        return Promise.reject(
          new errors.ValidationFailed(RESPONSE_MESSAGE.FIRST_NAME_REQUIRED)
        );
      }
      if (!registerUser.last_name) {
        return Promise.reject(
          new errors.ValidationFailed(RESPONSE_MESSAGE.LAST_NAME_REQUIRED)
        );
      }
    } else {
      if (!registerUser.name) {
        return Promise.reject(
          new errors.ValidationFailed(RESPONSE_MESSAGE.NAME_REQUIRED)
        );
      }
    }
    const user = await this.loginUtilityInst.findOne({
      username: registerUser.email,
    });
    if (!_.isEmpty(user)) {
      return Promise.reject(
        new errors.Conflict(RESPONSE_MESSAGE.EMAIL_ALREADY_REGISTERED)
      );
    }
    return Promise.resolve(registerUser);
  }

  /**
   *
   *
   * @param {*} userData
   * @returns
   * @memberof UserRegistrationService
   */
  async memberRegistration(userData) {
    try {
      await this.validateMemberRegistration(userData);

      console.log(userData);
      if (userData.country_code == "+91") {
        console.log("india");
        axios
          .post("https://test.yftchain.com/registration/in/register", userData)
          .then(function (response) {
            console.log(response);
          })
          .catch(function (error) {
            console.log(error);
          });
      } else if (userData.country_code == "+1") {
        console.log("usa");
        axios
          .post("/api/registration/usa/register", userData)
          .then(function (response) {
            console.log(response);
          })
          .catch(function (error) {
            console.log(error);
          });
      } else if (userData.country_code == "+86") {
        console.log("china");
        axios
          .post("/api/registration/ch/register", userData)
          .then(function (response) {
            console.log(response);
          })
          .catch(function (error) {
            console.log(error);
          });
      } else {
      }
      // return Promise.resolve();
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    }
  }

  /**
   * updates footPlayerCollection
   *
   * @param {*} [requestedData={}]
   * @returns
   * @memberof UserRegistrationService
   */
  async updateFootPlayerCollection(requestedData = {}) {
    try {
      let footplayerInvite = await this.footPlayerUtilityInst.findOne({
        "send_to.email": requestedData.email,
        status: FOOTPLAYER_STATUS.INVITED,
      });
      if (_.isEmpty(footplayerInvite)) {
        return Promise.resolve();
      }
      let updatedDoc = {};
      if (requestedData.member_type != MEMBER.PLAYER) {
        updatedDoc = { status: FOOTPLAYER_STATUS.REJECTED };
      } else {
        updatedDoc = {
          "send_to.user_id": requestedData.user_id,
          "send_to.name": `${requestedData.first_name} ${requestedData.last_name}`,
          "send_to.phone": requestedData.phone,
          status: FOOTPLAYER_STATUS.PENDING,
        };
      }
      await this.footPlayerUtilityInst.updateMany(
        {
          "send_to.email": requestedData.email,
          status: FOOTPLAYER_STATUS.INVITED,
        },
        updatedDoc
      );
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    }
  }

  /**
   *
   *
   * @param {*}
   *
   * @returns
   * @memberof UserRegistrationService
   */
  toAPIResponse({
    user_id,
    name,
    dob,
    role,
    email,
    avatar_url,
    state,
    country,
    phone,
    token,
    status,
    first_name,
    last_name,
    member_type,
    registration_number,
    is_email_verified,
  }) {
    return {
      user_id,
      name,
      dob,
      role,
      email,
      token,
      avatar_url,
      first_name,
      last_name,
      member_type,
      registration_number,
      state,
      country,
      phone,
      status,
      is_email_verified,
    };
  }

  async adminRegistration(adminDetails = {}) {
    const user = await this.loginUtilityInst.findOne({
      username: adminDetails.email,
    });
    if (!_.isEmpty(user)) {
      return Promise.reject(
        new errors.Conflict(RESPONSE_MESSAGE.EMAIL_ALREADY_REGISTERED)
      );
    }

    adminDetails.user_id = uuid();
    adminDetails.avatar_url = config.app.default_avatar_url; // default user icon

    let loginDetails = await this.loginUtilityInst.insert({
      user_id: adminDetails.user_id,
      username: adminDetails.email,
      status: ACCOUNT.ACTIVE,
      role: ROLE.ADMIN,
      password: adminDetails.password,
      profile_status: PROFILE.VERIFIED,
      is_email_verified: true,
    });
    adminDetails.login_details = loginDetails._id;

    await this.adminUtilityInst.insert(adminDetails);
  }

  /**
   * returns player type wrt dob
   *
   * @param {*} dob
   * @memberof UserRegistrationService
   */
  async getPlayerTypeFromDOB(dob) {
    try {
      let now = moment();
      let age = now.diff(dob, "years", true);
      let playerType = age > 12 ? PLAYER_TYPE.AMATEUR : PLAYER_TYPE.GRASSROOT;
      return Promise.resolve(playerType);
    } catch (e) {
      console.log(
        "Error in getPlayerTypeFromDOB() of UserRegistrationService",
        e
      );
      return Promise.reject(e);
    }
  }
}

module.exports = UserRegistrationService;
