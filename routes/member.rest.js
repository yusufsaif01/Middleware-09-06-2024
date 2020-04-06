const UserService = require('../services/UserService');
const responseHandler = require('../ResponseHandler');
const { checkAuthToken } = require('../middleware/auth');

module.exports = (router) => {
    /**
     * @api {get} /member/player/list?page_no=1&page_size=20&sort_by=created_at&sort_order=1&search=text member listing
     * @apiName member listing
     * @apiGroup Member
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": { "total":100,
     *                 "records":[{
     *                  "name": "first_name + last_name",
     *                  "position": "position of first priority",
     *                  "type":"grassroot/professional/amateur",
     *                  "email":"email of the player",
     *                  "status":"active/inactive/blocked/pending"
     *                           }],
     *                  “players_count”: {
     *                  "grassroot":10,
     *                  "professional":20,
     *                  "amateur":15   }
     *                }
     *     }
     *
     * @apiErrorExample {json} INTERNAL_SERVER_ERROR:
     *     HTTP/1.1 500 Internal server error
     *     {
     *       "message": "Internal Server Error",
     *       "code": "INTERNAL_SERVER_ERROR",
     *       "httpCode": 500
     *     }
     *
     */
    router.get('/member/player/list',checkAuthToken, function (req, res) {
        let paginationOptions = {};
        let sortOptions = {};
        let filter = {};

        paginationOptions = {
            page_no: (req.query && req.query.page_no) ? req.query.page_no : 1,
            limit: (req.query && req.query.limit) ? Number(req.query.limit) : 10
        };
        sortOptions = {
            sort_by: (req.query && req.query.sort_by) ? req.query.sort_by : "",
            sort_order: (req.query && req.query.sort_order) ? req.query.sort_order : 1
        };
        filter = {
            search: (req.query && req.query.search) ? req.query.search : null
        }
        let serviceInst = new UserService();
        responseHandler(req, res, serviceInst.getList({ paginationOptions, sortOptions, filter ,
            member_type: req.authUser.member_type,
        status:req.authUser.status }));
    });
};
