const BaseService = require("./BaseService");
const FootPlayerUtility = require("../db/utilities/FootPlayerUtility");
const PlayerUtility = require("../db/utilities/PlayerUtility");
const errors = require("../errors");
const RESPONSE_MESSAGE = require("../constants/ResponseMessage");

class FootPlayerService extends BaseService {
  constructor() {
    super();
    this.footPlayerUtilityInst = new FootPlayerUtility();
    this.playerInst = new PlayerUtility();
  }

  countDocs(paramas = {}) {
    const matchCriteria = {
      sent_by: paramas.criteria.sentBy,
      is_deleted: false,
    };
    return this.footPlayerUtilityInst.countList(matchCriteria);
  }

  async listAll(paramas = {}) {
    const matchCriteria = {
      sent_by: paramas.criteria.sentBy,
      is_deleted: false,
    };

    let searchConditions = {};

    if (paramas.filters.search) {
      let regexp = new RegExp(paramas.filters.search, "i");

      searchConditions["$or"] = [];

      searchConditions["$or"] = [
        "send_to.f_name",
        "send_to.l_name",
        "send_to.full_name",
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
            priority: "2",
          },
        },
      });
    }

    const projection = {
      $project: {
        id: 1,
        send_to_user: {
          position: 1,
          avatar_url: 1,
          player_type: 1,
        },
        status: 1,
        send_to: {
          full_name: {
            $concat: ["$send_to.f_name", " ", "$send_to.l_name"],
          },
          user_id: 1,
          f_name: 1,
          l_name: 1,
          email: 1,
          phone: 1,
        },
      },
    };

    let skipCount = (paramas.filters.page_no - 1) * paramas.filters.page_size;

    const aggPipes = [
      {
        $match: matchCriteria,
      },
      {
        $skip: parseInt(skipCount),
      },
      {
        $limit: parseInt(paramas.filters.page_size),
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
        $match: searchConditions,
      },
      projection,
    ];
    return this.footPlayerUtilityInst.aggregate(aggPipes);
  }

  async deleteRequest(requestId, userId) {
    try {

      const $where = {
        id: requestId,
        sent_by: userId,
        is_deleted:false
      };

      let request = await this.footPlayerUtilityInst.findOne($where);

      if (request) {
        let date = Date.now();
        await this.footPlayerUtilityInst.findOneAndUpdate(
          $where,
          { is_deleted: true, deleted_at: date }
        );
        return Promise.resolve();
      }

      throw new errors.NotFound(RESPONSE_MESSAGE.FOOTMATE_REQUEST_NOT_FOUND);
      
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  }; 
}

module.exports = FootPlayerService;
