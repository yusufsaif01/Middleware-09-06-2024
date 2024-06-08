const Promise = require("bluebird");
const errors = require("../errors");
const config = require("../config");
const ActivityService = require("./ActivityService");
const AuthUtility = require("../db/utilities/AuthUtility");
const ClubAcademyUtility = require("../db/utilities/ClubAcademyUtility");
const AdminUtility = require("../db/utilities/AdminUtility");
const PlayerUtility = require("../db/utilities/PlayerUtility");
const coacheUtility = require("../db/utilities/CoacheUtility");
const LoginUtility = require("../db/utilities/LoginUtility");
const LoginUtilityReplica = require("../db/utilities/LoginUtilityReplic");
const ActivityUtility = require("../db/utilities/ActivityUtility");
const EmailService = require("./EmailService");
const RESPONSE_MESSAGE = require("../constants/ResponseMessage");
const ACCOUNT = require("../constants/AccountStatus");
const MEMBER = require("../constants/MemberType");
const ROLE = require("../constants/Role");
const ACTIVITY = require("../constants/Activity");
const redisServiceInst = require("../redis/RedisService");
const UtilityService = require("./UtilityService");
const ProfileStatus = require("../constants/ProfileStatus");
const OtpService = require("./OtpService");
class AuthService {
  constructor() {
    this.authUtilityInst = new AuthUtility();
    this.adminUtilityInst = new AdminUtility();
    this.playerUtilityInst = new PlayerUtility();
    this.coacheUtilityInst = new coacheUtility();
    this.loginUtilityInst = new LoginUtility();
    this.activityUtilityInst = new ActivityUtility();
    this.clubAcademyUtilityInst = new ClubAcademyUtility();
    this.emailService = new EmailService();
    this.utilityService = new UtilityService();
    this.LoginUtilityReplica = new LoginUtilityReplica();
  }
  async emailVerification(data) {
    try {
      let loginDetails = await this.loginUtilityInst.findOne({
        user_id: data.user_id,
      });
      if (loginDetails) {
        await this.loginUtilityInst.updateOne(
          { user_id: loginDetails.user_id },
          {
            is_email_verified: true,
            status: ACCOUNT.ACTIVE,
          }
        );
        return Promise.resolve();
      }
      throw new errors.NotFound(RESPONSE_MESSAGE.USER_NOT_FOUND);
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async login(email, password) {
    try {
      await this.loginValidator(email, password);
      const loginDetails = await this.findByCredentials(email, password);
 
      ActivityService.loginActivity(loginDetails.user_id, ACTIVITY.LOGIN);
      const tokenForAuthentication = await this.authUtilityInst.getAuthToken(
        loginDetails.user_id,
        email,
        loginDetails.member_type
      );
      await this.loginUtilityInst.updateOne(
        { user_id: loginDetails.user_id },
        { token: tokenForAuthentication }
      );
      let avatarUrl = "";
      if (loginDetails.member_type === MEMBER.PLAYER) {
        const { avatar_url } = await this.playerUtilityInst.findOne(
          { user_id: loginDetails.user_id },
          { avatar_url: 1 }
        );
        avatarUrl = avatar_url;
      } else if (loginDetails.member_type === MEMBER.coache) {
        const { avatar_url } = await this.coacheUtilityInst.findOne(
          { user_id: loginDetails.user_id },
          { avatar_url: 1 }
        );
        avatarUrl = avatar_url;
      } else if (loginDetails.role === ROLE.ADMIN) {
        const { avatar_url } = await this.adminUtilityInst.findOne(
          { user_id: loginDetails.user_id },
          { avatar_url: 1 }
        );
        avatarUrl = avatar_url;
      } else {
        const { avatar_url } = await this.clubAcademyUtilityInst.findOne(
          { user_id: loginDetails.user_id },
          { avatar_url: 1 }
        );
        avatarUrl = avatar_url;
      }
      await redisServiceInst.setUserCache(tokenForAuthentication, {
        ...loginDetails,
        avatar_url: avatarUrl,
      });
      console.log("before return");
      console.log(loginDetails);
      return {
        ...loginDetails,
        avatar_url: avatarUrl,
        token: tokenForAuthentication,
      };
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    }
  }

  loginValidator(email, password) {
    if (!email) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.EMAIL_REQUIRED)
      );
    }
    if (!password) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.PASSWORD_REQUIRED)
      );
    }
    return Promise.resolve(email, password);
  }

  async findByCredentials(email, password) {
    try {
      let loginDetails = await this.loginUtilityInst.findOne({
        username: email,
      });
      if (loginDetails) {
        if (loginDetails.status === ACCOUNT.BLOCKED) {
          return Promise.reject(
            new errors.Unauthorized(RESPONSE_MESSAGE.USER_BLOCKED)
          );
        }
        if (!loginDetails.password) {
          return Promise.reject(
            new errors.Unauthorized(RESPONSE_MESSAGE.ACCOUNT_NOT_ACTIVATED)
          );
        }
        if (!loginDetails.is_email_verified) {
          return Promise.reject(
            new errors.Unauthorized(RESPONSE_MESSAGE.EMAIL_NOT_VERIFIED)
          );
        }
        let isPasswordMatched = await this.authUtilityInst.bcryptTokenCompare(
          password,
          loginDetails.password
        );
        if (!isPasswordMatched) {
          return Promise.reject(new errors.InvalidCredentials());
        }
        return {
          user_id: loginDetails.user_id,
          email: loginDetails.username,
          role: loginDetails.role,
          member_type: loginDetails.member_type,
          status: loginDetails.status ? loginDetails.status : "-",
        };
      }
      let loginDetailsOfDeletedUser = await this.loginUtilityInst.aggregate([
        { $match: { username: email, is_deleted: true } },
      ]);
      if (loginDetailsOfDeletedUser.length) {
        throw new errors.Unauthorized(RESPONSE_MESSAGE.USER_DELETED);
      }
      throw new errors.InvalidCredentials(RESPONSE_MESSAGE.USER_NOT_REGISTERED);
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async logout(data) {
    try {
      if (data && data.user_id && data.token) {
        await this.loginUtilityInst.updateOne(
          { user_id: data.user_id },
          { token: "" }
        );
        await ActivityService.loginActivity(data.user_id, ACTIVITY.LOGOUT);
        await redisServiceInst.clearCurrentTokenFromCache(
          data.token,
          data.user_id
        );
      }
      return Promise.resolve();
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  passwordValidator(email) {
    if (!email) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.EMAIL_REQUIRED)
      );
    }
    return Promise.resolve(email);
  }

  async forgotPassword(email) {
    try {
      await this.passwordValidator(email);
      let loginDetails = await this.loginUtilityInst.findOne({
        username: email,
      });
      if (loginDetails) {
        if (loginDetails.status === ACCOUNT.BLOCKED) {
          return Promise.reject(
            new errors.Unauthorized(RESPONSE_MESSAGE.USER_BLOCKED)
          );
        }
        if (loginDetails.status !== ACCOUNT.ACTIVE) {
          await this.resendEmailVerificationLink(loginDetails);
          return Promise.resolve();
        }
        const tokenForForgetPassword = await this.authUtilityInst.getAuthToken(
          loginDetails.user_id,
          email,
          loginDetails.member_type
        );
        let resetPasswordURL =
          config.app.baseURL + "reset-password?token=" + tokenForForgetPassword;

        await this.loginUtilityInst.updateOne(
          { user_id: loginDetails.user_id },
          {
            forgot_password_token: tokenForForgetPassword,
          }
        );
        loginDetails.forgot_password_token = tokenForForgetPassword;
        await redisServiceInst.setCacheForForgotPassword(
          loginDetails.user_id,
          tokenForForgetPassword,
          { ...loginDetails }
        );

        let user_name = "";

        user_name = await this.getProfileName(loginDetails, user_name);

         const serviceInst = new OtpService();
         const OTP = await serviceInst.otp_generate_for_forgot_password(
           email,
           resetPasswordURL,
           loginDetails.first_name || loginDetails.name
         );

      //  await this.emailService.forgotPassword(
       //   email,
      //    resetPasswordURL,
      //    user_name
      //  );
        return Promise.resolve({ userId: loginDetails.user_id });
      }
      throw new errors.Unauthorized(RESPONSE_MESSAGE.USER_NOT_REGISTERED);
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  async getProfileName(loginDetails, user_name) {
    if (loginDetails.role == ROLE.PLAYER) {
      let profileDetails = await this.playerUtilityInst.findOne(
        {
          user_id: loginDetails.user_id,
        },
        { first_name: 1 }
      );
      user_name = profileDetails.first_name;
    }
    if ([ROLE.CLUB, ROLE.ACADEMY].includes(loginDetails.role)) {
      let profileDetails = await this.clubAcademyUtilityInst.findOne(
        {
          user_id: loginDetails.user_id,
        },
        { name: 1 }
      );
      user_name = profileDetails.name;
    }
    if (loginDetails.role == ROLE.ADMIN) {
      let profileDetails = await this.adminUtilityInst.findOne(
        {
          user_id: loginDetails.user_id,
        },
        { name: 1 }
      );
      user_name = profileDetails.name;
    }
    return user_name;
  }

  async changePassword(
    tokenData,
    old_password,
    new_password,
    confirm_password
  ) {
    try {
      await this.validateChangePassword(
        tokenData,
        old_password,
        new_password,
        confirm_password
      );

      let loginDetails = await this.loginUtilityInst.findOne({
        user_id: tokenData.user_id,
      });
      if (loginDetails) {
        if (loginDetails.status !== ACCOUNT.ACTIVE) {
          return Promise.reject(
            new errors.ValidationFailed(RESPONSE_MESSAGE.ACCOUNT_NOT_ACTIVATED)
          );
        }

        let isPasswordMatched = await this.authUtilityInst.bcryptTokenCompare(
          old_password,
          loginDetails.password
        );
        if (!isPasswordMatched) {
          return Promise.reject(
            new errors.BadRequest(RESPONSE_MESSAGE.OLD_PASSWORD_INCORRECT)
          );
        }

        let password = await this.authUtilityInst.bcryptToken(new_password);
        let isSamePassword = await this.authUtilityInst.bcryptTokenCompare(
          old_password,
          password
        );
        if (isSamePassword) {
          return Promise.reject(
            new errors.BadRequest(RESPONSE_MESSAGE.SAME_PASSWORD)
          );
        }
        await this.loginUtilityInst.updateOne(
          { user_id: loginDetails.user_id },
          { password: password }
        );
        await redisServiceInst.clearAllTokensFromCache(tokenData.user_id);
        let profileName = "";

        profileName = await this.getProfileName(loginDetails, profileName);
        await this.emailService.changePassword(
          loginDetails.username,
          profileName
        );
        return Promise.resolve();
      }
      throw new errors.Unauthorized(RESPONSE_MESSAGE.USER_NOT_REGISTERED);
    } catch (err) {
      console.log(err);
      return Promise.reject(err);
    }
  }

  validateChangePassword(
    tokenData,
    old_password,
    new_password,
    confirm_password
  ) {
    if (!tokenData) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.TOKEN_REQUIRED)
      );
    }
    if (!old_password) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.OLD_PASSWORD_REQUIRED)
      );
    }

    if (!new_password) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.NEW_PASSWORD_REQUIRED)
      );
    }
    if (!confirm_password) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.CONFIRM_PASSWORD_REQUIRED)
      );
    }
    if (confirm_password !== new_password) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.PASSWORDS_DO_NOT_MATCH)
      );
    }

    return Promise.resolve();
  }

  async createPassword(tokenData, new_password, confirmPassword) {
    try {
      console.log("inside createpassword first try");
      //  await this.validateCreatePassword(tokenData, new_password, confirmPassword);
      // let loginDetails = await this.loginUtilityInst.findOne({ user_id: tokenData.user_id })
      const userData = {};
      userData.tokenData = tokenData;
      userData.new_password = new_password;
      userData.confirmPassword = confirmPassword;
      axios
        .post("https://test.yftchain.com/registration/in/create-password", userData)
        .then(function (response) {
          console.log(response);
        })
        .catch(function (error) {
          console.log(error);
        });
      throw new errors.Unauthorized(RESPONSE_MESSAGE.USER_NOT_REGISTERED);
    } catch (e) {
      console.log("inside catch of 6666");
      console.log(e);
      return Promise.reject(e);
    }
  }

  async resetPassword(userId, new_password, confirmPassword) {
    try {
      console.log("user id in middleware is->",userId)
      await this.validateCreatePassword(
      
        new_password,
        confirmPassword
      );

      let loginDetails = await this.loginUtilityInst.findOne({
        user_id: userId,
      });
      if (loginDetails) {
        if (loginDetails.status === ACCOUNT.BLOCKED) {
          return Promise.reject(
            new errors.Unauthorized(RESPONSE_MESSAGE.USER_BLOCKED)
          );
        }
        if (loginDetails.status !== ACCOUNT.ACTIVE) {
          return Promise.reject(
            new errors.ValidationFailed(RESPONSE_MESSAGE.ACCOUNT_NOT_ACTIVATED)
          );
        }
        const password = await this.authUtilityInst.bcryptToken(new_password);
        await this.loginUtilityInst.updateOne(
          { user_id: loginDetails.user_id },
          { password: password, forgot_password_token: "" }
        );
      //  await redisServiceInst.deleteByKey(
       //   `keyForForgotPassword${tokenData.forgot_password_token}`
       // );
       // await redisServiceInst.clearAllTokensFromCache(tokenData.user_id);
        let profileName = "";
        profileName = await this.getProfileName(loginDetails, profileName);
        await this.emailService.changePassword(
          loginDetails.username,
          profileName
        );
        return Promise.resolve();
      }
      throw new errors.Unauthorized(RESPONSE_MESSAGE.USER_NOT_REGISTERED);
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    }
  }

  validateCreatePassword( password, confirmPassword) {
   

    if (!password) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.PASSWORD_REQUIRED)
      );
    }
    if (!confirmPassword) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.CONFIRM_PASSWORD_REQUIRED)
      );
    }
    if (password !== confirmPassword) {
      return Promise.reject(
        new errors.ValidationFailed(RESPONSE_MESSAGE.PASSWORDS_DO_NOT_MATCH)
      );
    }
    return Promise.resolve();
  }

  async resendEmailVerificationLink(loginDetails = {}) {
    try {
      const tokenForAccountActivation = await this.authUtilityInst.getAuthToken(
        loginDetails.user_id,
        loginDetails.username,
        loginDetails.member_type
      );
      await redisServiceInst.deleteByKey(
        `keyForForgotPassword${loginDetails.forgot_password_token}`
      );
      await redisServiceInst.setKeyValuePair(
        `keyForForgotPassword${tokenForAccountActivation}`,
        loginDetails.user_id
      );
      await this.loginUtilityInst.updateOne(
        { user_id: loginDetails.user_id },
        { forgot_password_token: tokenForAccountActivation }
      );
      let userDataFromCache = await redisServiceInst.getUserFromCacheByKey(
        loginDetails.user_id
      );
      userDataFromCache.forgot_password_token = tokenForAccountActivation;
      await redisServiceInst.setKeyValuePair(
        loginDetails.user_id,
        JSON.stringify(userDataFromCache)
      );
      let accountActivationURL =
        config.app.baseURL +
        "create-password?token=" +
        tokenForAccountActivation;
      let user_name = "";
      user_name = await this.getProfileName(loginDetails, user_name);
      this.emailService.emailVerification(
        loginDetails.username,
        accountActivationURL,
        user_name
      );
      return Promise.resolve();
    } catch (e) {
      console.log("Error in resendEmailVerificationLink() of AuthService", e);
      return Promise.reject(e);
    }
  }

  async afterlinkexpire(loginDetails = {}) {
    try {
      console.log("inside Authservice link");
    } catch (e) {
      console.log("Error in resendEmailVerificationLink() of AuthService", e);
      return Promise.reject(e);
    }
  }
}

module.exports = AuthService;
