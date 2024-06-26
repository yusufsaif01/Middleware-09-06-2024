const ReportCardUtility = require('../db/utilities/ReportCardUtility');
const errors = require("../errors");
const RESPONSE_MESSAGE = require('../constants/ResponseMessage');
const REPORT_CARD_STATUS = require('../constants/ReportCardStatus');
const FOOTPLAYER_STATUS = require('../constants/FootPlayerStatus');
const FootPlayerUtility = require('../db/utilities/FootPlayerUtility');
const ManageReportCardListResponseMapper = require("../dataModels/responseMapper/ManageReportCardListResponseMapper");
const PlayerReportCardListResponseMapper = require("../dataModels/responseMapper/PlayerReportCardListResponseMapper");
const _ = require("lodash");
const moment = require('moment');
const LoginUtility = require('../db/utilities/LoginUtility');
const MEMBER = require('../constants/MemberType');
const reportCardValidator = require("../middleware/validators").reportCardValidator;
const AbilityUtility = require('../db/utilities/AbilityUtility');
const AttributeUtility = require('../db/utilities/AttributeUtility');
const EmailService = require('./EmailService');
const PlayerUtility = require('../db/utilities/PlayerUtility');
const ClubAcademyUtility = require('../db/utilities/ClubAcademyUtility');
const PROFILE_STATUS = require('../constants/ProfileStatus');

class ReportCardService {
    constructor() {
        this.reportCardUtilityInst = new ReportCardUtility();
        this.footPlayerUtilityInst = new FootPlayerUtility();
        this.loginUtilityInst = new LoginUtility();
        this.abilityUtilityInst = new AbilityUtility();
        this.attributeUtilityInst = new AttributeUtility();
        this.emailService = new EmailService();
        this.playerUtilityInst = new PlayerUtility();
        this.clubAcademyUtilityInst = new ClubAcademyUtility();
    }

    /**
     * returns report card list for club/academy
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async getManageReportCardList(requestedData = {}) {
        try {
            let searchConditions = this.prepareManageReportCardSearchCondition(requestedData.filters);
            let filterConditions = this.prepareManageReportCardFilterCondition(requestedData.filters);
            let paginationOptions = requestedData.paginationOptions || {};
            let sortOptions = requestedData.sortOptions || {};
            let skipCount = (paginationOptions.page_no - 1) * paginationOptions.limit;
            let options = { limit: paginationOptions.limit, skip: skipCount, sort: {} };
            options.sort[sortOptions.sort_by] = sortOptions.sort_order;

            let data = await this.footPlayerUtilityInst.aggregate([
                { $match: { "sent_by": requestedData.authUser.user_id, status: FOOTPLAYER_STATUS.ADDED, is_deleted: false } },
                { $lookup: { from: "player_details", localField: "send_to.user_id", foreignField: "user_id", as: "player_detail" } },
                { $unwind: { path: "$player_detail" } },
                { $lookup: { from: "report_cards", localField: "player_detail.user_id", foreignField: "send_to", as: "report_card" } },
                {
                    $project: {
                        player_detail: {
                            first_name: 1, last_name: 1, player_type: 1, user_id: 1, avatar_url: 1,
                            report_card: {
                                $filter: {
                                    input: "$report_card", as: "element",
                                    cond: {
                                        $and: [{ $eq: ["$$element.is_deleted", false] },
                                        { $not: { $and: [{ $eq: ["$$element.status", REPORT_CARD_STATUS.DRAFT] }, { $ne: ["$$element.sent_by", requestedData.authUser.user_id] }] } }]
                                    }
                                }
                            },
                        }
                    }
                },
                {
                    $project: {
                        player_detail: {
                            avatar_url: 1, first_name: 1, last_name: 1, player_type: 1, user_id: 1,
                            draft_report_card: {
                                $filter: {
                                    input: "$player_detail.report_card", as: "element",
                                    cond: { $eq: ["$$element.status", REPORT_CARD_STATUS.DRAFT] }
                                }
                            }, report_card: {
                                $filter: {
                                    input: "$player_detail.report_card", as: "element",
                                    cond: { $ne: ["$$element.status", REPORT_CARD_STATUS.DRAFT] }
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        player_detail: {
                            avatar_url: 1, first_name: 1, last_name: 1, player_type: 1, user_id: 1, draft_report_card: 1,
                            report_card: 1, draft_status: { $cond: { if: { $eq: ["$player_detail.draft_report_card", []] }, then: false, else: true } }

                        }
                    }
                },
                {
                    $project: {
                        player_detail: {
                            avatar_url: 1, first_name: 1, last_name: 1, player_type: 1, user_id: 1,
                            draft_report_card: 1, draft_status: 1, report_card: 1, total_report_cards: { $size: "$player_detail.report_card" }
                        }
                    }
                },
                { $unwind: { path: "$player_detail.report_card", preserveNullAndEmptyArrays: true } },
                { $sort: { "player_detail.report_card.published_at": -1 } },
                { $group: { _id: "$player_detail.user_id", player_detail: { $first: "$player_detail" } } },
                {
                    $project: {
                        avatar_url: "$player_detail.avatar_url", first_name: "$player_detail.first_name", last_name: "$player_detail.last_name",
                        name: { $toLower: { $concat: ["$player_detail.first_name", " ", "$player_detail.last_name"] } }, category: "$player_detail.player_type",
                        user_id: "$player_detail.user_id", total_report_cards: "$player_detail.total_report_cards",
                        status: {
                            $cond: {
                                if: { $eq: ["$player_detail.draft_status", true] }, then: REPORT_CARD_STATUS.DRAFT, else: "$player_detail.report_card.status"
                            }
                        }, published_at: "$player_detail.report_card.published_at", created_at: "$player_detail.report_card.createdAt", draft_report_card: "$player_detail.draft_report_card"
                    }
                },
                { $match: filterConditions }, { $match: searchConditions }, { $sort: options.sort },
                { $facet: { data: [{ $skip: options.skip }, { $limit: options.limit }], total_data: [{ $group: { _id: null, count: { $sum: 1 } } }] } }
            ]);
            let responseData = [], totalRecords = 0;
            if (data && data.length && data[0] && data[0].data) {
                responseData = new ManageReportCardListResponseMapper().map(data[0].data);
                if (data[0].data.length && data[0].total_data && data[0].total_data.length && data[0].total_data[0].count) {
                    totalRecords = data[0].total_data[0].count;
                }
            }
            let response = { total: totalRecords, records: responseData }
            return Promise.resolve(response);
        } catch (e) {
            console.log("Error in getManageReportCardList() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * prepare search conditions for manage report card list
     *
     * @param {*} [filters={}]
     * @returns
     * @memberof ReportCardService
     */
    prepareManageReportCardSearchCondition(filters = {}) {
        let condition = {};
        let filterArr = []
        if (filters.search) {
            filters.search = filters.search.trim()
            filterArr.push({ "name": new RegExp(filters.search, "i") })
            condition = { $or: filterArr };
        }
        return condition;
    }

    /**
     * prepare filter conditions for manage report card list
     *
     * @param {*} [filterConditions={}]
     * @returns
     * @memberof ReportCardService
     */
    prepareManageReportCardFilterCondition(filterConditions = {}) {
        let condition = {};
        let filterArr = []
        if (filterConditions) {
            if (filterConditions.from && filterConditions.to) {
                let published_at = [];
                let fromDate = moment(filterConditions.from).toDate();
                let toDate = moment(filterConditions.to).toDate();
                published_at.push({
                    "published_at": {
                        $gte: fromDate,
                        $lte: toDate
                    }
                });
                filterArr.push({ $or: published_at })
            }
            if (filterConditions.player_category && filterConditions.player_category.length) {
                let player_category = [];
                filterConditions.player_category.forEach(val => {
                    player_category.push({ "category": new RegExp(val, 'i') })
                });
                filterArr.push({ $or: player_category })
            }
            if (filterConditions.status && filterConditions.status.length) {
                let status = [];
                filterConditions.status.forEach(val => {
                    status.push({ "status": new RegExp(val, 'i') })
                });
                filterArr.push({ $or: status })
            }
            condition = {
                $and: filterArr
            }
        }
        return filterArr.length ? condition : {}
    }

    /**
     * create report card for player
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async createReportCard(requestedData = {}) {
        try {
            let reqObj = await this.createReportCardValidation(requestedData);
            let now = moment();
            reqObj.published_at = new Date(now.format("YYYY-MM-DD"));
            reqObj.sent_by = requestedData.authUser.user_id;
            let player_detail = await this.playerUtilityInst.findOne({ user_id: reqObj.send_to }, { first_name: 1, email: 1 });
            let club_academy_detail = await this.clubAcademyUtilityInst.findOne({ user_id: requestedData.authUser.user_id }, { name: 1 });
            await this.reportCardUtilityInst.insert(reqObj);
            if (reqObj.status === REPORT_CARD_STATUS.PUBLISHED) {
                this.emailService.reportCardAdded({
                    player_name: player_detail.first_name,
                    club_academy_name: club_academy_detail.name, player_email: player_detail.email, published_at: now.format("DD-MMMM-YYYY").split('-').join(' ')
                });
            }
            return Promise.resolve();
        } catch (e) {
            console.log("Error in createReportCard() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates request data for create report card
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async createReportCardValidation(requestedData = {}) {
        try {
            let reqObj = await this.parseAbilities(requestedData.reqObj);
            await reportCardValidator.createReportCardValidation(reqObj);
            reqObj = await this.validateAbilitiesAttributes(reqObj);
            await this.profileVerification(requestedData.authUser.user_id, reqObj.send_to);
            let footplayer_details = await this.footPlayerUtilityInst.findOne({ sent_by: requestedData.authUser.user_id, status: FOOTPLAYER_STATUS.ADDED, "send_to.user_id": reqObj.send_to });
            if (_.isEmpty(footplayer_details)) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.NOT_FOOTPLAYER));
            }
            let draft_details = await this.reportCardUtilityInst.findOne({ sent_by: requestedData.authUser.user_id, send_to: reqObj.send_to, status: REPORT_CARD_STATUS.DRAFT });
            if (!_.isEmpty(draft_details)) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.DRAFT_EXISTS));
            }
            return Promise.resolve(reqObj);
        } catch (e) {
            console.log("Error in createReportCardValidation() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates abilities and attributes id
     *
     * @param {*} [reqObj={}]
     * @returns
     * @memberof ReportCardService
     */
    async validateAbilitiesAttributes(reqObj = {}) {
        try {
            if (reqObj.abilities) {
                const { map } = require("bluebird");
                let msg = null;
                let abilityArray = [];
                let abilityWithAttributeScore = 0;
                let abilityIdArray = await map(reqObj.abilities, (ability) => ability.ability_id);
                let abilitiesDB = await this.abilityUtilityInst.aggregate([
                    { $match: { id: { $in: abilityIdArray } } },
                    { $lookup: { from: "attributes", localField: "id", foreignField: "ability_id", as: "attributes" } },
                    { $project: { _id: 0, id: 1, name: 1, attributes: { id: 1, name: 1 } } }
                ]);
                await map(reqObj.abilities, async (ability) => {
                    let abilityObj = {};
                    let foundAbility = _.find(abilitiesDB, { id: ability.ability_id });
                    if (_.isEmpty(foundAbility)) {
                        msg = RESPONSE_MESSAGE.ABILITY_NOT_FOUND
                    }
                    else {
                        abilityObj.ability_id = ability.ability_id;
                        abilityObj.ability_name = foundAbility.name;
                        let attributeArray = [];
                        let attributeScoreCount = 0;
                        await map(ability.attributes, async (attribute) => {
                            let attributeObj = {};
                            let foundAttribute = _.find(foundAbility.attributes, { id: attribute.attribute_id });
                            if (_.isEmpty(foundAttribute)) {
                                msg = RESPONSE_MESSAGE.ATTRIBUTE_NOT_FOUND
                            }
                            else {
                                attributeObj.attribute_id = attribute.attribute_id;
                                attributeObj.attribute_name = foundAttribute.name;
                                attributeObj.attribute_score = attribute.attribute_score;
                                attributeArray.filter((val) => {
                                    if (val.attribute_id === attributeObj.attribute_id) {
                                        msg = RESPONSE_MESSAGE.DUPLICATE_ATTRIBUTE_ID
                                    }
                                })
                                if (attributeObj.attribute_score > 0)
                                    attributeScoreCount += 1;
                                attributeArray.push(attributeObj);
                            }
                        })
                        abilityObj.attributes = attributeArray;
                        abilityArray.filter((val) => {
                            if (val.ability_id === abilityObj.ability_id) {
                                msg = RESPONSE_MESSAGE.DUPLICATE_ABILITY_ID
                            }
                        })
                        if (attributeScoreCount >= 3)
                            abilityWithAttributeScore += 1;
                        abilityArray.push(abilityObj);
                    }
                })
                if (msg) {
                    return Promise.reject(new errors.ValidationFailed(msg));
                }
                if (abilityWithAttributeScore < 3) {
                    return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.SCORE_CRITERIA_FAILED))
                }
                reqObj.abilities = abilityArray;
            }
            return Promise.resolve(reqObj)
        } catch (e) {
            console.log("Error in validateAbilitiesAttributes() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * parses abilities array
     *
     * @param {*} [reqObj={}]
     * @returns
     * @memberof ReportCardService
     */
    async parseAbilities(reqObj = {}) {
        try {
            if (reqObj.abilities) {
                let abilities = JSON.parse(reqObj.abilities);
                reqObj.abilities = abilities;
            }
            return Promise.resolve(reqObj)
        } catch (e) {
            console.log(e);
            return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.INVALID_VALUE_ABILITY));
        }
    }

    /**
     * edit report card with draft status
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async editReportCard(requestedData = {}) {
        try {
            let reqObj = await this.editReportCardValidation(requestedData);
            let now = moment();
            reqObj.published_at = new Date(now.format("YYYY-MM-DD"));
            reqObj.sent_by = requestedData.authUser.user_id;
            let player_detail = await this.playerUtilityInst.findOne({ user_id: reqObj.send_to }, { first_name: 1, email: 1 });
            let club_academy_detail = await this.clubAcademyUtilityInst.findOne({ user_id: requestedData.authUser.user_id }, { name: 1 });
            await this.reportCardUtilityInst.updateOne({ id: requestedData.report_card_id }, reqObj);
            if (reqObj.status === REPORT_CARD_STATUS.PUBLISHED) {
                this.emailService.reportCardAdded({
                    player_name: player_detail.first_name,
                    club_academy_name: club_academy_detail.name, player_email: player_detail.email, published_at: now.format("DD-MMMM-YYYY").split('-').join(' ')
                });
            }
            return Promise.resolve();
        } catch (e) {
            console.log("Error in editReportCard() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates request data for edit report card
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async editReportCardValidation(requestedData = {}) {
        try {
            let reqObj = await this.parseAbilities(requestedData.reqObj);
            await reportCardValidator.editReportCardValidation(reqObj);
            reqObj = await this.validateAbilitiesAttributes(reqObj);
            let foundReportCard = await this.reportCardUtilityInst.findOne({ sent_by: requestedData.authUser.user_id, id: requestedData.report_card_id }, { status: 1, send_to: 1 });
            if (_.isEmpty(foundReportCard)) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.REPORT_CARD_NOT_FOUND));
            }
            if (foundReportCard.status !== REPORT_CARD_STATUS.DRAFT) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.REPORT_CARD_CANNOT_BE_EDITED));
            }
            await this.profileVerification(requestedData.authUser.user_id, foundReportCard.send_to);
            reqObj.send_to = foundReportCard.send_to;
            return Promise.resolve(reqObj);
        } catch (e) {
            console.log("Error in editReportCardValidation() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * manage player report card list for club/academy
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async getManagePlayerReportCardList(requestedData = {}) {
        try {
            await this.validatePlayerUserId(requestedData.player_id);
            await this.checkIsFootplayer(requestedData.authUser.user_id, requestedData.player_id);
            let paginationOptions = requestedData.paginationOptions || {};
            let skipCount = (paginationOptions.page_no - 1) * paginationOptions.limit;
            let options = { limit: paginationOptions.limit, skip: skipCount };

            let data = await this.reportCardUtilityInst.aggregate([
                { $match: { send_to: requestedData.player_id, is_deleted: false, $or: [{ status: { $ne: REPORT_CARD_STATUS.DRAFT } }, { sent_by: requestedData.authUser.user_id }] } },
                { $lookup: { from: "club_academy_details", localField: "sent_by", foreignField: "user_id", as: "club_academy_detail" } },
                { $unwind: { path: "$club_academy_detail" } },
                { $project: { sent_by: 1, created_by: "$club_academy_detail.name", published_at: 1, created_at: "$createdAt", status: 1, id: 1, _id: 0 } },
                { $sort: { created_at: -1 } },
                { $facet: { data: [{ $skip: options.skip }, { $limit: options.limit }], total_data: [{ $group: { _id: null, count: { $sum: 1 } } }] } }
            ]);
            let responseData = [], totalRecords = 0;
            if (data && data.length && data[0] && data[0].data) {
                responseData = data[0].data;
                if (data[0].data.length && data[0].total_data && data[0].total_data.length && data[0].total_data[0].count) {
                    totalRecords = data[0].total_data[0].count;
                }
            }
            let draft = await this.reportCardUtilityInst.findOne({
                sent_by: requestedData.authUser.user_id,
                send_to: requestedData.player_id, status: REPORT_CARD_STATUS.DRAFT
            }, { id: 1, _id: 0 });
            let player_detail = await this.playerUtilityInst.findOne({ user_id: requestedData.player_id }, { first_name: 1, last_name: 1 });
            let response = {
                total: totalRecords, draft_id: draft ? draft.id : null,
                player_name: `${player_detail.first_name} ${player_detail.last_name}`, records: responseData
            }
            return Promise.resolve(response);
        } catch (e) {
            console.log("Error in getManagePlayerReportCardList() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates player user_id
     *
     * @param {*} user_id
     * @returns
     * @memberof ReportCardService
     */
    async validatePlayerUserId(user_id) {
        let user = await this.loginUtilityInst.findOne({ user_id: user_id, member_type: MEMBER.PLAYER });
        if (!user) {
            return Promise.reject(new errors.NotFound(RESPONSE_MESSAGE.PLAYER_NOT_FOUND));
        }
        return Promise.resolve();
    }

    /**
     * checks if the player is a footplayer of the club/academy
     *
     * @param {*} club_academy_id
     * @param {*} player_id
     * @returns
     * @memberof ReportCardService
     */
    async checkIsFootplayer(club_academy_id, player_id) {
        let footplayer = await this.footPlayerUtilityInst.findOne({ sent_by: club_academy_id, "send_to.user_id": player_id });
        if (!footplayer) {
            return Promise.reject(new errors.NotFound(RESPONSE_MESSAGE.NOT_FOOTPLAYER));
        }
        return Promise.resolve();
    }

    /**
     * view report card
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async viewReportCard(requestedData = {}) {
        try {
            let report_card_details = await this.viewReportCardValidation(requestedData);
            return Promise.resolve(report_card_details);
        } catch (e) {
            console.log("Error in viewReportCard() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * validates view report card request 
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async viewReportCardValidation(requestedData = {}) {
        try {
            let foundReportCard = await this.reportCardUtilityInst.findOne({ id: requestedData.report_card_id },
                { _id: 0, sent_by: 1, id: 1, send_to: 1, remarks: 1, published_at: 1, status: 1, abilities: 1 });
            if (_.isEmpty(foundReportCard)) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.REPORT_CARD_NOT_FOUND));
            }
            if (foundReportCard.status === REPORT_CARD_STATUS.DRAFT && foundReportCard.sent_by !== requestedData.authUser.user_id) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.NOT_ALLOWED_TO_VIEW_OTHER_DRAFT));
            }
            let associated_club_academy = await this.footPlayerUtilityInst.aggregate([{ $match: { is_deleted: false, "send_to.user_id": foundReportCard.send_to } },
            { $project: { _id: 0, user_id: "$sent_by" } }
            ]);
            let allowed_users = associated_club_academy.concat({ user_id: foundReportCard.send_to });
            if (!allowed_users.some(val => val.user_id === requestedData.authUser.user_id)) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.NOT_ALLOWED_TO_VIEW_REPORT_CARD));
            }
            return Promise.resolve(foundReportCard);
        } catch (e) {
            console.log("Error in viewReportCardValidation() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * report card list for player
     *
     * @param {*} [requestedData={}]
     * @returns
     * @memberof ReportCardService
     */
    async getPlayerReportCardList(requestedData = {}) {
        try {
            let searchConditions = this.prepareManageReportCardSearchCondition(requestedData.filters);
            let filterConditions = this.preparePlayerReportCardFilterCondition(requestedData.filters);
            let paginationOptions = requestedData.paginationOptions || {};
            let sortOptions = requestedData.sortOptions || {};
            let skipCount = (paginationOptions.page_no - 1) * paginationOptions.limit;
            let options = { limit: paginationOptions.limit, skip: skipCount, sort: {} };
            options.sort[sortOptions.sort_by] = sortOptions.sort_order;

            let data = await this.reportCardUtilityInst.aggregate([
                { $match: { send_to: requestedData.authUser.user_id, is_deleted: false, status: REPORT_CARD_STATUS.PUBLISHED } },
                { $lookup: { from: "club_academy_details", localField: "sent_by", foreignField: "user_id", as: "club_academy_detail" } },
                { $unwind: { path: "$club_academy_detail" } },
                { $project: { sent_by: 1, name: "$club_academy_detail.name", created_at: "$createdAt", created_by: "$club_academy_detail.member_type", published_at: 1, id: 1, _id: 0 } },
                { $match: filterConditions }, { $match: searchConditions }, { $sort: options.sort },
                { $facet: { data: [{ $skip: options.skip }, { $limit: options.limit }], total_data: [{ $group: { _id: null, count: { $sum: 1 } } }] } }
            ]);
            let responseData = [], totalRecords = 0;
            if (data && data.length && data[0] && data[0].data) {
                responseData = new PlayerReportCardListResponseMapper().map(data[0].data);
                if (data[0].data.length && data[0].total_data && data[0].total_data.length && data[0].total_data[0].count) {
                    totalRecords = data[0].total_data[0].count;
                }
            }
            let response = { total: totalRecords, records: responseData }
            return Promise.resolve(response);
        } catch (e) {
            console.log("Error in getPlayerReportCardList() of ReportCardService", e);
            return Promise.reject(e);
        }
    }

    /**
     * prepare filter conditions for player report card list
     *
     * @param {*} [filterConditions={}]
     * @returns
     * @memberof ReportCardService
     */
    preparePlayerReportCardFilterCondition(filterConditions = {}) {
        let condition = {};
        let filterArr = []
        if (filterConditions) {
            if (filterConditions.from && filterConditions.to) {
                let published_at = [];
                let fromDate = moment(filterConditions.from).toDate();
                let toDate = moment(filterConditions.to).toDate();
                published_at.push({
                    "published_at": {
                        $gte: fromDate,
                        $lte: toDate
                    }
                });
                filterArr.push({ $or: published_at })
            }
            if (filterConditions.name) {
                filterArr.push({
                    "name": new RegExp(filterConditions.name, 'i')
                });
            }
            if (filterConditions.created_by && filterConditions.created_by.length) {
                let created_by = [];
                filterConditions.created_by.forEach(val => {
                    created_by.push({ "created_by": new RegExp(val, 'i') })
                });
                filterArr.push({ $or: created_by })
            }
            condition = {
                $and: filterArr
            }
        }
        return filterArr.length ? condition : {}
    }


    /**
     * checks if profile of logged in user or player is verified
     *
     * @param {*} authUser_id
     * @param {*} player_id
     * @returns
     * @memberof ReportCardService
     */
    async profileVerification(authUser_id, player_id) {
        try {
            let player_detail = await this.loginUtilityInst.findOne({ user_id: player_id, member_type: MEMBER.PLAYER }, { profile_status: 1 });
            if (_.isEmpty(player_detail)) {
                return Promise.reject(new errors.NotFound(RESPONSE_MESSAGE.PLAYER_NOT_FOUND));
            }
            if (player_detail.profile_status.status !== PROFILE_STATUS.VERIFIED) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.PLAYER_PROFILE_NOT_VERIFIED));
            }
            let user_details = await this.loginUtilityInst.findOne({
                user_id: authUser_id,
                "profile_status.status": PROFILE_STATUS.VERIFIED
            });
            if (_.isEmpty(user_details)) {
                return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.USER_PROFILE_NOT_VERIFIED));
            }
            return Promise.resolve();
        } catch (e) {
            console.log("Error in profileVerification() of ReportCardService", e);
            return Promise.reject(e);
        }
    }
}

module.exports = ReportCardService;