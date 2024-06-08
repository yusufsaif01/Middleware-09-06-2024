const Promise = require("bluebird");
const errors = require("../errors");
const LoginUtility = require("../db/utilities/LoginUtility");
const PlayerUtility = require("../db/utilities/PlayerUtility");
const TraningCenterUtility = require("../db/utilities/TraningCenterUtility");
const coacheUtility = require("../db/utilities/CoacheUtility");
const ClubAcademyUtility = require("../db/utilities/ClubAcademyUtility");
const AuthUtility = require("../db/utilities/AuthUtility");
const FootCoachUtilityInst= require("../db/utilities/FootCoachUtility")
const EmailService = require("./EmailService");
const config = require("../config");
const _ = require("lodash");
const AdminUtility = require("../db/utilities/AdminUtility");
const FootPlayerUtility = require("../db/utilities/FootPlayerUtility");

const axios = require("axios");
/**
 *
 *
 * @class UserRegistrationService
 * @extends {UserService}
 */
class CreateTraningCenterService {
  /**
   *Creates an instance of UserRegistrationService.
   * @memberof UserRegistrationService
   */
  constructor() {
    this.footCoachUtilityInst = new FootCoachUtilityInst();
    this.playerUtilityInst = new PlayerUtility();
    this.coacheUtility = new coacheUtility();
    this.traningCenterUtility = new TraningCenterUtility();
    this.clubAcademyUtilityInst = new ClubAcademyUtility();
    this.loginUtilityInst = new LoginUtility();
    this.authUtilityInst = new AuthUtility();
    this.emailService = new EmailService();
    this.adminUtilityInst = new AdminUtility();
    this.footPlayerUtilityInst = new FootPlayerUtility();
  }

  async createTraningCenter(userData) {
    try {
      axios
        .post(
          `https://test.yftchain.com/registration/in/create_traning_center`,
          userData
        )
        .then(function (response) {
          console.log(response);
        })
        .catch(function (error) {
          console.log(error);
        });
    } catch (e) {
      console.log(e);
      return Promise.reject(e);
    }
  }

  async getList(requestedData = {}) {
    try {
      let response = {},
        totalRecords = 0;
      let paginationOptions = requestedData.paginationOptions || {};
      let skipCount = (paginationOptions.page_no - 1) * paginationOptions.limit;
      let options = {
        limit: paginationOptions.limit,
        skip: skipCount,
        sort: { from: -1 },
      };
      let projection = {
        full_address: 1,
        traning_center_name: 1,
        pincode: 1,
        coache_name: 1,
        academy_user_id: 1,
        user_id: 1,
        id: 1,
      };
      let data = await this.traningCenterUtility.find(
        { academy_user_id: requestedData.user_id },
        projection,
        options
      );
      totalRecords = await this.traningCenterUtility.countList({
        academy_user_id: requestedData.user_id,
      });
      // data = new AchievementListResponseMapper().map(data);
      response = {
        total: totalRecords,
        records: data,
      };

      return response;
    } catch (e) {
      console.log("Error in getList() of AchievementService", e);
      return Promise.reject(e);
    }
  }

  async delete({ id, user_id }) {
    try {
      let foundTraningCenter = await this.traningCenterUtility.findOne({
        id: id,
        academy_user_id: user_id,
      });
      console.log("traning center forun");
      console.log(foundTraningCenter);
      if (foundTraningCenter) {
        await this.traningCenterUtility.findOneAndUpdate(
          { id: id },
          { is_deleted: true, deleted_at: Date.now() }
        );
        return Promise.resolve();
      }
      // throw new errors.NotFound(RESPONSE_MESSAGE.ACHIEVEMENT_NOT_FOUND);
    } catch (e) {
      console.log("Error in delete() of AchievementService", e);
      return Promise.reject(e);
    }
  }

  //coache List

  async getcoacheList(id) {
    try {
      console.log("inside getcoacheList ===========>");
      console.log("id is", id);

      let data = await this.footCoachUtilityInst.find({ sent_by: id });
      return data;
    } catch (e) {
      console.log("Error in getList() of AchievementService", e);
      return Promise.reject(e);
    }
  }
}

module.exports = CreateTraningCenterService;
