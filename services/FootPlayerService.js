const FootPlayerUtility = require('../db/utilities/FootPlayerUtility');
const LoginUtility = require('../db/utilities/LoginUtility');
const MEMBER = require('../constants/MemberType');
const PROFILE_STATUS = require('../constants/ProfileStatus');
const FOOTPLAYER_STATUS = require('../constants/FootPlayerStatus');
const FootPlayerSearchListResponseMapper = require("../dataModels/responseMapper/FootPlayerSearchListResponseMapper");
const FootPlayerRequestListResponseMapper = require("../dataModels/responseMapper/FootplayerRequestListResponseMapper");
const RESPONSE_MESSAGE = require('../constants/ResponseMessage');
const _ = require("lodash");
const PlayerUtility = require('../db/utilities/PlayerUtility');
const errors = require("../errors");
const EmailService = require('./EmailService');
const ClubAcademyUtility = require('../db/utilities/ClubAcademyUtility');
const ConnectionService = require('./ConnectionService');
const config = require("../config");
const moment = require('moment');
const ClubFootPlayersResponseMapping = require("../dataModels/responseMapper/ClubFootPlayersResponseMapping");

class FootPlayerService {

    constructor() {
        this.footPlayerUtilityInst = new FootPlayerUtility();
        this.loginUtilityInst = new LoginUtility();
        this.playerUtilityInst = new PlayerUtility();
        this.emailService = new EmailService();
        this.clubAcademyUtilityInst = new ClubAcademyUtility();
    }

    /**
     * get list of players
     *
     * @param {*} [requestedData={}]
     * @returns 
     * @memberof FootPlayerService
     */
    async footplayerSearch(requestedData = {}) {
        try {
            let filterConditions = this._preparePlayerFilterCondition(requestedData.filterConditions)
            let data = await this.loginUtilityInst.aggregate([{ $match: { is_deleted: false, member_type: MEMBER.PLAYER } },
            { $project: { user_id: 1, profile_status: 1, _id: 0 } }, { "$lookup": { "from": "player_details", "localField": "user_id", "foreignField": "user_id", "as": "player_detail" } }, { $unwind: { path: "$player_detail" } },
            { $project: { player_detail: { user_id: 1, email: 1, first_name: 1, last_name: 1, is_verified: { $cond: { if: { $eq: ["$profile_status.status", PROFILE_STATUS.VERIFIED] }, then: true, else: false } }, position: 1, member_type: MEMBER.PLAYER, player_type: 1, avatar_url: 1, phone: 1 } } },
            { "$lookup": { "from": "foot_players", "localField": "player_detail.user_id", "foreignField": "send_to.user_id", "as": "footplayerDocument" } },
            { $project: { player_detail: 1, filteredfootplayerDocument: { $filter: { input: "$footplayerDocument", as: "element", cond: { $and: [{ $ne: ["$$element.sent_by", requestedData.user_id] }, { $eq: ["$$element.status", FOOTPLAYER_STATUS.ADDED] }, { $eq: ["$$element.is_deleted", false] }] } } } } },
            { $unwind: { path: "$filteredfootplayerDocument", preserveNullAndEmptyArrays: true } },
            { "$lookup": { "from": "club_academy_details", "localField": "filteredfootplayerDocument.sent_by", "foreignField": "user_id", "as": "SentBy" } },
            { $project: { player_detail: 1, club: { $filter: { input: "$SentBy", as: "element", cond: { $eq: ["$$element.member_type", MEMBER.CLUB] } } } } },
            { $unwind: { path: "$club", preserveNullAndEmptyArrays: true } }, { "$group": { _id: "$player_detail.user_id", player_detail: { $first: "$player_detail" }, club: { $addToSet: "$club" } } },
            { $unwind: { path: "$club", preserveNullAndEmptyArrays: true } },
            { $project: { player_detail: { user_id: 1, email: 1, first_name: 1, is_verified: 1, last_name: 1, position: 1, member_type: 1, player_type: 1, avatar_url: 1, phone: 1, club_name: "$club.name" } } },
            { $match: filterConditions }]);
            if (_.isEmpty(data)) {
                filterConditions = this._prepareClubAcademyFilterCondition(requestedData.filterConditions);
                data = await this.loginUtilityInst.aggregate([{ $match: { is_deleted: false, member_type: { $in: [MEMBER.CLUB, MEMBER.ACADEMY] } } },
                { $project: { user_id: 1, profile_status: 1, _id: 0 } }, { "$lookup": { "from": "club_academy_details", "localField": "user_id", "foreignField": "user_id", "as": "club_academy_detail" } }, { $unwind: { path: "$club_academy_detail" } },
                { $project: { club_academy_detail: { user_id: 1, name: 1, member_type: 1, is_verified: { $cond: { if: { $eq: ["$profile_status.status", PROFILE_STATUS.VERIFIED] }, then: true, else: false } }, type: 1, phone: 1, avatar_url: 1, email: 1 } } },
                { $match: filterConditions }]);
            }
            data = new FootPlayerSearchListResponseMapper().map(data);
            return { total: data.length, records: data };
        } catch (e) {
            console.log("Error in getPlayerList() of FootPlayerService", e);
            return Promise.reject(e);
        }
    }

    /**
     * prepare filter condition for player
     *
     * @param {*} [filterConditions={}]
     * @returns
     * @memberof FootPlayerService
     */
    _preparePlayerFilterCondition(filterConditions = {}) {
        let condition = {};
        let filterArr = []
        if (filterConditions) {
            if (filterConditions.email) {
                filterArr.push({ "player_detail.email": filterConditions.email })
            }
            if (filterConditions.phone) {
                filterArr.push({ "player_detail.phone": filterConditions.phone })
            }
            condition = {
                $and: filterArr
            }
        }
        return filterArr.length ? condition : {}
    }

    /**
     * send footplayer request
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async sendFootplayerRequest(requestedData = {}) {
        try {
            await this.sendFootplayerRequestValidator(requestedData);
            let send_to_data = await this.playerUtilityInst.findOne({ user_id: requestedData.send_to }, { first_name: 1, last_name: 1, phone: 1, email: 1, _id: 0 });
            await this.footPlayerUtilityInst.insert({
                sent_by: requestedData.sent_by,
                send_to: { user_id: requestedData.send_to, name: `${send_to_data.first_name} ${send_to_data.last_name}`, email: send_to_data.email, phone: send_to_data.phone }
            });
            let sent_by_data = await this.clubAcademyUtilityInst.findOne({ user_id: requestedData.sent_by }, { name: 1, member_type: 1, _id: 0 });
            this.emailService.footplayerRequest(send_to_data.email, { member_type: sent_by_data.member_type, name: sent_by_data.name });
            return Promise.resolve();
        } catch (e) {
            console.log("Error in sendFootplayerRequest() of FootPlayerService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates requestedData for sendFootplayerRequest
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async sendFootplayerRequestValidator(requestedData = {}) {
        let sent_by_details = await this.loginUtilityInst.findOne({ user_id: requestedData.sent_by }, { profile_status: 1 });
        if (sent_by_details.profile_status && sent_by_details.profile_status.status && sent_by_details.profile_status.status != PROFILE_STATUS.VERIFIED) {
            return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.USER_PROFILE_NOT_VERIFIED));
        }
        if (requestedData.send_to === requestedData.sent_by) {
            return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.CANNOT_SEND_FOOTPLAYER_REQUEST_TO_YOURSELF));
        }
        if (requestedData.send_to) {
            let to_be_footplayer = await this.loginUtilityInst.findOne({ user_id: requestedData.send_to, member_type: MEMBER.PLAYER }, { profile_status: 1 });
            if (_.isEmpty(to_be_footplayer)) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.MEMBER_TO_BE_FOOTPLAYER_NOT_FOUND));
            }
            if (to_be_footplayer && to_be_footplayer.profile_status && to_be_footplayer.profile_status.status && to_be_footplayer.profile_status.status != PROFILE_STATUS.VERIFIED) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.PLAYER_NOT_VERIFIED));
            }
        }
        let footplayerRequest = await this.footPlayerUtilityInst.findOne({ sent_by: requestedData.sent_by, "send_to.user_id": requestedData.send_to }, { status: 1, _id: 1 });
        if (!_.isEmpty(footplayerRequest)) {
            if (footplayerRequest.status === FOOTPLAYER_STATUS.PENDING) {
                return Promise.reject(new errors.Conflict(RESPONSE_MESSAGE.FOOTPLAYER_REQUEST_ALREADY_SENT));
            }
            if (footplayerRequest.status === FOOTPLAYER_STATUS.ADDED) {
                return Promise.reject(new errors.Conflict(RESPONSE_MESSAGE.ALREADY_FOOTPLAYER));
            }
        }
        if (requestedData.member_type === MEMBER.CLUB) {
            await this.isFootplayerOfOtherClub(requestedData.send_to)
        }
        return Promise.resolve();
    }

    /**
     * checks if user is a footplayer of other club
     *
     * @param {*} user_id
     * @returns
     * @memberof FootPlayerService
     */
    async isFootplayerOfOtherClub(user_id) {
        try {
            let data = await this.footPlayerUtilityInst.aggregate([{ $match: { "send_to.user_id": user_id, status: FOOTPLAYER_STATUS.ADDED, is_deleted: false } },
            { "$lookup": { "from": "club_academy_details", "localField": "sent_by", "foreignField": "user_id", "as": "club_academy_detail" } },
            { $project: { club: { $filter: { input: "$club_academy_detail", as: "element", cond: { $eq: ["$$element.member_type", MEMBER.CLUB] } } } } },
            { $unwind: { path: "$club" } }, { $project: { _id: 0, footplayerOfClub: { $cond: { if: { $eq: ["$club", []] }, then: false, else: true } } } }
            ]);
            if (data && data.length > 0 && data[0] && data[0].footplayerOfClub) {
                return Promise.reject(new errors.Conflict(RESPONSE_MESSAGE.ALREADY_FOOTPLAYER_OF_OTHER_CLUB));
            }
            return Promise.resolve();
        }
        catch (e) {
            console.log("Error in isFootplayerOfClub() of FootPlayerService", e);
            return Promise.reject(e);
        }
    }

    /**
     * prepare filter condition for club academy
     *
     * @param {*} [filterConditions={}]
     * @returns
     * @memberof FootPlayerService
     */
    _prepareClubAcademyFilterCondition(filterConditions = {}) {
        let condition = {};
        if (filterConditions) {
            if (filterConditions.email && !filterConditions.phone) {
                condition = { "club_academy_detail.email": filterConditions.email };
            }
            if (filterConditions.phone && !filterConditions.email) {
                condition = { "club_academy_detail.phone": filterConditions.phone }
            }
            if (filterConditions.phone && filterConditions.email) {
                condition = { $and: [{ "club_academy_detail.email": filterConditions.email }, { "club_academy_detail.phone": filterConditions.phone }] };
            }
        }
        return condition;
    }

    /**
     * get footplayer requests list
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async getFootplayerRequestList(requestedData = {}) {
        try {
            let paginationOptions = requestedData.paginationOptions || {};
            let requested_by = requestedData.filterConditions.requested_by;
            let skipCount = (paginationOptions.page_no - 1) * paginationOptions.limit;
            let options = { limit: paginationOptions.limit, skip: skipCount };
            let data = await this.footPlayerUtilityInst.aggregate([{ $match: { "send_to.user_id": requestedData.user_id, status: FOOTPLAYER_STATUS.PENDING, is_deleted: false } },
            { $project: { sent_by: 1, request_id: "$id" } },
            { "$lookup": { "from": "club_academy_details", "localField": "sent_by", "foreignField": "user_id", "as": "club_academy_detail" } },
            { $unwind: { path: "$club_academy_detail" } }, { $project: { club_academy_detail: { request_id: "$request_id", user_id: 1, name: 1, type: 1, avatar_url: 1, member_type: 1 } } },
            { $match: { "club_academy_detail.member_type": requested_by } },
            { $facet: { data: [{ $skip: options.skip }, { $limit: options.limit },], total_data: [{ $group: { _id: null, count: { $sum: 1 } } }] } }]);
            let responseData = [], totalRecords = 0;
            if (data && data.length && data[0] && data[0].data) {
                responseData = new FootPlayerRequestListResponseMapper().map(data[0].data);
                if (data[0].data.length && data[0].total_data && data[0].total_data.length && data[0].total_data[0].count) {
                    totalRecords = data[0].total_data[0].count;
                }
            }
            let response = { total: totalRecords, records: responseData }
            return Promise.resolve(response);
        }
        catch (e) {
            console.log("Error in getFootplayerRequestList() of FootPlayerService", e);
            return Promise.reject(e);
        }
    }

    /**
     * accept footplayer request
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async acceptFootplayerRequest(requestedData = {}) {
        try {
            await this.footplayerRequestValidator(requestedData);
            let updateOneCondition = { status: FOOTPLAYER_STATUS.PENDING, sent_by: requestedData.sent_by, "send_to.user_id": requestedData.user_id };
            await this.footPlayerUtilityInst.updateOne(updateOneCondition, { status: FOOTPLAYER_STATUS.ADDED });
            let clubRequestsInPending = await this.footPlayerUtilityInst.aggregate([{ $match: { "send_to.user_id": requestedData.user_id, status: FOOTPLAYER_STATUS.PENDING, is_deleted: false } },
            { "$lookup": { "from": "club_academy_details", "localField": "sent_by", "foreignField": "user_id", "as": "club_academy_detail" } },
            { $project: { _id: 0, club: { $filter: { input: "$club_academy_detail", as: "element", cond: { $eq: ["$$element.member_type", MEMBER.CLUB] } } } } },
            { $unwind: { path: "$club" } }, { $project: { sent_by: "$club.user_id" } }]);
            if (clubRequestsInPending && clubRequestsInPending.length) {
                let updatedDoc = { status: FOOTPLAYER_STATUS.REJECTED };
                await this.footPlayerUtilityInst.updateMany({ $or: clubRequestsInPending }, updatedDoc);
            }
            let serviceInst = new ConnectionService();
            await serviceInst.followMember({ sent_by: requestedData.sent_by, send_to: requestedData.user_id }, true);
            await serviceInst.followMember({ sent_by: requestedData.user_id, send_to: requestedData.sent_by }, true);
            return Promise.resolve();
        }
        catch (e) {
            console.log("Error in acceptFootplayerRequest() of FootPlayerService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates requestedData for acceptFootplayerRequest
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async footplayerRequestValidator(requestedData = {}) {
        let current_user = await this.loginUtilityInst.findOne({ user_id: requestedData.user_id, member_type: MEMBER.PLAYER }, { profile_status: 1 });
        if (current_user && current_user.profile_status && current_user.profile_status.status && current_user.profile_status.status != PROFILE_STATUS.VERIFIED) {
            return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.PROFILE_NOT_VERIFIED));
        }
        let dataOfSentBy = await this.clubAcademyUtilityInst.findOne({ user_id: requestedData.sent_by }, { member_type: 1, });
        if (_.isEmpty(dataOfSentBy)) {
            return Promise.reject(new errors.NotFound(RESPONSE_MESSAGE.SENT_BY_USER_NOT_FOUND));
        }
        let footplayerRequest = await this.footPlayerUtilityInst.findOne({ status: FOOTPLAYER_STATUS.PENDING, sent_by: requestedData.sent_by, "send_to.user_id": requestedData.user_id });
        if (_.isEmpty(footplayerRequest)) {
            return Promise.reject(new errors.NotFound(RESPONSE_MESSAGE.FOOTPLAYER_REQUEST_NOT_FOUND));
        }
        if (dataOfSentBy && dataOfSentBy.member_type && dataOfSentBy.member_type === MEMBER.CLUB) {
            await this.isFootplayerOfOtherClub(requestedData.user_id);
        }
        return Promise.resolve();
    }

    /**
     * reject footplayer request
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async rejectFootplayerRequest(requestedData = {}) {
        try {
            await this.footplayerRequestValidator(requestedData);
            let updateOneCondition = { status: FOOTPLAYER_STATUS.PENDING, sent_by: requestedData.sent_by, "send_to.user_id": requestedData.user_id };
            let updatedDoc = { status: FOOTPLAYER_STATUS.REJECTED };
            await this.footPlayerUtilityInst.updateOne(updateOneCondition, updatedDoc);
            return Promise.resolve();
        }
        catch (e) {
            console.log("Error in rejectFootPlayerRequest() of FootPlayerService", e);
            return Promise.reject(e);
        }
    }

    /**
     * sends footplayer invite 
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async sendFootplayerInvite(requestedData = {}) {
        try {
            await this.ValidateFootplayerInvite(requestedData);

            let send_to = requestedData.send_to;
            let record = {
                sent_by: requestedData.sent_by, status: FOOTPLAYER_STATUS.INVITED,
                send_to: {
                    user_id: "", name: send_to.name || "", email: send_to.email || "", phone: send_to.phone || ""
                }
            }
            await this.footPlayerUtilityInst.insert(record);
            let registration_link = config.app.baseURL + "register";
            let sent_by_data = await this.clubAcademyUtilityInst.findOne({ user_id: requestedData.sent_by }, { name: 1, member_type: 1, _id: 0 });
            this.emailService.sendFootplayerInvite(send_to.email, { member_type: sent_by_data.member_type, name: sent_by_data.name }, registration_link);
            return Promise.resolve();
        } catch (e) {
            console.log("Error in sendFootPlayerInvite() of FootPlayerService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates requestedData for sendFootplayerInvite
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async ValidateFootplayerInvite(requestedData = {}) {
        let sent_by_details = await this.loginUtilityInst.findOne({ user_id: requestedData.sent_by }, { profile_status: 1 });
        if (sent_by_details.profile_status && sent_by_details.profile_status.status && sent_by_details.profile_status.status != PROFILE_STATUS.VERIFIED) {
            return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.USER_PROFILE_NOT_VERIFIED));
        }
        let foundUser = await this.loginUtilityInst.findOne({ username: requestedData.send_to.email });
        if (!_.isEmpty(foundUser)) {
            return Promise.reject(new errors.Conflict(RESPONSE_MESSAGE.EMAIL_ALREADY_REGISTERED));
        }
        let footplayerInvite = await this.footPlayerUtilityInst.findOne({ sent_by: requestedData.sent_by, status: FOOTPLAYER_STATUS.INVITED, "send_to.email": requestedData.send_to.email });
        if (!_.isEmpty(footplayerInvite)) {
            return Promise.reject(new errors.Conflict(RESPONSE_MESSAGE.INVITE_ALREADY_SENT));
        }
        return Promise.resolve();
    }

    /**
     * resends footplayer invite 
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async resendFootplayerInvite(requestedData = {}) {
        try {
            await this.ValidateResendFootplayerInvite(requestedData);
            let registration_link = config.app.baseURL + "register";
            let sent_by_data = await this.clubAcademyUtilityInst.findOne({ user_id: requestedData.sent_by }, { name: 1, member_type: 1, _id: 0 });
            this.emailService.sendFootplayerInvite(requestedData.send_to.email, { member_type: sent_by_data.member_type, name: sent_by_data.name }, registration_link);
            return Promise.resolve();
        } catch (e) {
            console.log("Error in resendFootPlayerInvite() of FootPlayerService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates requestedData for resendFootplayerInvite
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof FootPlayerService
     */
    async ValidateResendFootplayerInvite(requestedData = {}) {
        let sent_by_details = await this.loginUtilityInst.findOne({ user_id: requestedData.sent_by }, { profile_status: 1 });
        if (sent_by_details.profile_status && sent_by_details.profile_status.status && sent_by_details.profile_status.status != PROFILE_STATUS.VERIFIED) {
            return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.USER_PROFILE_NOT_VERIFIED));
        }
        let foundUser = await this.loginUtilityInst.findOne({ username: requestedData.send_to.email });
        if (!_.isEmpty(foundUser)) {
            return Promise.reject(new errors.Conflict(RESPONSE_MESSAGE.EMAIL_ALREADY_REGISTERED));
        }
        let footplayerInvite = await this.footPlayerUtilityInst.findOne({ sent_by: requestedData.sent_by, status: FOOTPLAYER_STATUS.INVITED, "send_to.email": requestedData.send_to.email });
        if (_.isEmpty(footplayerInvite)) {
            return Promise.reject(new errors.NotFound(RESPONSE_MESSAGE.INVITE_NOT_FOUND));
        }
        return Promise.resolve();
    }

    countDocs(paramas = {}) {
    try {
      const matchCriteria = {
        sent_by: paramas.criteria.sentBy,
        is_deleted: false,
      };
      return this.footPlayerUtilityInst.countList(matchCriteria);
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  }

  async listAll(paramas = {}) {
    try {
      const matchCriteria = this.getMatchCriteria(paramas);
      const filterConditions = this._prepareFootplayerFilterCondition(paramas.filters);

      let searchConditions = {};

      if (paramas.filters.search) {
        this.prepateSearchFilters(paramas, searchConditions);
      }

      const projection = this.prepareProjection();

      let skipCount = (paramas.filters.page_no - 1) * paramas.filters.page_size;

      const aggPipes = this.prepareAggregatePipes(
        matchCriteria,
        skipCount,
        paramas,
        filterConditions,
        searchConditions,
        projection
      );
      let data = await this.footPlayerUtilityInst.aggregate(aggPipes);
      let responseData = [], totalRecords = 0;
      if (data && data.length && data[0] && data[0].data) {
          responseData = new ClubFootPlayersResponseMapping().map(data[0].data);
          if (data[0].data.length && data[0].total_data && data[0].total_data.length && data[0].total_data[0].count) {
              totalRecords = data[0].total_data[0].count;
          }
      }
      let response = { total: totalRecords, records: responseData }
      return Promise.resolve(response);
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  }

  prepareAggregatePipes(
    matchCriteria,
    skipCount,
    paramas,
    filterConditions,
    searchConditions,
    projection
  ) {
    return [
      {
        $match: matchCriteria,
      },
      {
        $lookup: {
          from: "player_details",
          localField: "send_to.user_id",
          foreignField: "user_id",
          as: "send_to_user",
        },
      },
      {
        $unwind: {
          path: "$send_to_user",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: { from: "positions", localField: "send_to_user.position.id", foreignField: "id", as: "Position" }
      },
      {
        $lookup: { from: "abilities", localField: "Position.abilities", foreignField: "id", as: "abilities" }
      },
      {
        $match: filterConditions,
      },
      {
        $match: searchConditions,
      },
      projection,
      { $facet: { data: [{ $skip: parseInt(skipCount) }, { $limit: parseInt(paramas.filters.page_size) },], total_data: [{ $group: { _id: null, count: { $sum: 1 } } }] } }
    ];
  }

  prepareProjection() {
    return {
      $project: {
        id: 1,
        send_to_user: {
          position: 1,
          avatar_url: 1,
          player_type: 1,
        },
        status: 1,
        send_to: {
          user_id: 1,
          name: 1,
          email: 1,
          phone: 1,
        },
      },
    };
  }

  prepateSearchFilters(paramas, searchConditions) {
    let regexp = new RegExp(paramas.filters.search, "i");
    searchConditions["$or"] = [];
    searchConditions["$or"] = [
      "send_to.name",
      "send_to_user.player_type",
    ].map((field) => {
      return {
        [field]: regexp,
      };
    });
    searchConditions["$or"].push({
      "send_to_user.position": {
        $elemMatch: {
          name: regexp,
          priority: "1",
        },
      },
    });
  }

  getMatchCriteria(paramas) {
    return {
      sent_by: paramas.criteria.sentBy,
      is_deleted: false,
    };
  }

  async deleteRequest(requestId, userId) {
    try {
      const $where = {
        id: requestId,
        sent_by: userId,
        is_deleted: false,
      };

      let request = await this.footPlayerUtilityInst.findOne($where);

      if (request) {
        let date = Date.now();
        await this.footPlayerUtilityInst.updateOne($where, {
          is_deleted: true,
          deleted_at: date,
        });
        return Promise.resolve();
      }

      throw new errors.NotFound(RESPONSE_MESSAGE.FOOTMATE_REQUEST_NOT_FOUND);
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  }
  _prepareFootplayerFilterCondition(filterConditions = {}) {
    let condition = {};
    let filterArr = []
    if (filterConditions) {
      if (filterConditions.age && filterConditions.age.length) {
        let age = [];
        let date = new Date();
        let current_year = date.getFullYear()
        let current_month = date.getMonth()
        let current_day = date.getDate()

        filterConditions.age.forEach(val => {
          let [lowerEndAge, higherEndAge] = val.split("-")
          let gteYear = Number(current_year) - Number(higherEndAge);
          let lteYear = Number(current_year) - Number(lowerEndAge)
          let gteDate = new Date(gteYear, current_month, current_day);
          let lteDate = new Date(lteYear, current_month, current_day);
          let momentGteDate = moment(gteDate).format("YYYY-MM-DD");
          let momentLteDate = moment(lteDate).format("YYYY-MM-DD");
          age.push({
            "send_to_user.dob": {
              $gte: momentGteDate,
              $lte: momentLteDate
            }
          });
        });
        filterArr.push({ $or: age })
      }
      if (filterConditions.country) {
        filterArr.push({
          "send_to_user.country.name": new RegExp(filterConditions.country, 'i')
        });
      }
      if (filterConditions.state) {
        filterArr.push({
          "send_to_user.state.name": new RegExp(filterConditions.state, 'i')
        });
      }
      if (filterConditions.city) {
        filterArr.push({
          "send_to_user.city.name": new RegExp(filterConditions.city, 'i')
        });
      }
      if (filterConditions.strong_foot && filterConditions.strong_foot.length) {
        let strong_foot = [];
        filterConditions.strong_foot.forEach(val => {
          strong_foot.push({ "send_to_user.strong_foot": new RegExp(val, 'i') })
        });
        filterArr.push({ $or: strong_foot })
      }
      if (filterConditions.position && filterConditions.position.length) {
        let position = [];
        filterConditions.position.forEach(val => {
          position.push({
            "send_to_user.position": {
              $elemMatch: {
                name: new RegExp(val, 'i'),
              }
            }
          })
        });
        filterArr.push({ $or: position })
      }
      if (filterConditions.footplayer_category && filterConditions.footplayer_category.length) {
        let footplayer_category = [];
        filterConditions.footplayer_category.forEach(val => {
          footplayer_category.push({ "send_to_user.player_type": new RegExp(val, 'i') })
        });
        filterArr.push({ $or: footplayer_category })
      }
      if (filterConditions.status && filterConditions.status.length) {
        let status = [];
        filterConditions.status.forEach(val => {
          status.push({ "status": new RegExp(val, 'i') })
        });
        filterArr.push({ $or: status })
      }
      if (filterConditions.ability && filterConditions.ability.length) {
        let ability = [];
        filterConditions.ability.forEach(val => {
          ability.push({
            "abilities": {
              $elemMatch: {
                name: new RegExp(val, 'i'),
              }
            }
          })
        });
        filterArr.push({ $or: ability })
      }
      condition = {
        $and: filterArr
      }
    }
    return filterArr.length ? condition : {}
  }

}

module.exports = FootPlayerService;
