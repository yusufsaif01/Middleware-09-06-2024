const { checkAuthToken } = require("../middleware/auth");
const responseHandler = require("../ResponseHandler");
const errors = require("../errors");
const RESPONSE_MESSAGE = require("../constants/ResponseMessage");
const ClubAcademyDocumentService = require("../services/ClubAcademyDocumentService");
const ClubAcademyDocumentResponseMapper = require("../dataModels/responseMapper/ClubAcademyDocumentResponseMapper.js");
const updateStatusValidator = require("../middleware/validators/member-documents/updateStatusValidator");
const auth = require("../middleware/auth");
const Role = require("../constants/Role");
const axios = require("axios");
const clubAcademyInst = new ClubAcademyDocumentService();

module.exports = (router) => {
  /**
   * @api {get} /club-academy/:user_id/documents Get Club Academy Documents listing
   * @apiName Club academy documents listing
   * @apiGroup Club Academy Documents
   *
   * @apiSuccess {String} status success
   * @apiSuccess {String} message Successfully done
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "status": "success",
   *       "message": "successfully done",
   *       "data": {
   *         "name": "",
   *         "date_of_birth": "",
   *         "documents": [
   *           {
   *              "type": "AIFF",
   *              "added_on": "",
   *              "document_number": "",
   *              "media": {
   *                "attachment_type": "image",
   *                "document": ""
   *              },
   *              "status": "disapproved",
   *              "remark": "reason of disapproved"
   *            }
   *         ]
   *       }
   *     }
   *
   * @apiErrorExample {json} INTERNAL_SERVER_ERROR:
   *     HTTP/1.1 500 Internal server error
   *     {
   *       "message": "Internal Server Error",
   *       "code": "INTERNAL_SERVER_ERROR",
   *       "httpCode": 500
   *     }
   * @apiErrorExample {object} NOT_FOUND
   * HTTP/1.1 404 Not Found
   * {
   *      "message": "User not found",
   *      "code": "NOT_FOUND",
   *      "httpCode": 404
   *  }
   *
   */
  router.get(
    "/club-academy/:user_id/documents",
    checkAuthToken,
    auth.checkRole([Role.ADMIN]),
    async (req, res) => {
      let { user_id } = req.params;

      try {
        responseHandler(
          req,
          res,
          Promise.resolve(
            ClubAcademyDocumentResponseMapper.map(
              await clubAcademyInst.getUserDocuments(user_id)
            )
          )
        );
      } catch (e) {
        responseHandler(req, res, Promise.reject(e));
      }
    }
  );

  router.get("/attendance/status",function (req, res) {
    console.log("inside middlewareeeeeeeeeeeeeeeee");
    console.log(req.query.user_id)
    console.log(req.query.lat);
    const obj = {}
    obj.user_id = req.query.user_id;
    obj.lat = req.query.lat;
    obj.long = req.query.long
    
       axios
         .post("https://test.yftchain.com/club/academy/in/attendance/status", obj)
         .then(function (response) {
           console.log("---------------------");
           console.log(response);
           return res.json(response);
         })
         .catch(function (error) {
           console.log(error);
         });
     
  });

  /**
   * @api {put} /club-academy/:user_id/documents/status Update Club/Academy document status
   * @apiName Club academy documents update status
   * @apiGroup Club Academy Documents
   *
   * @apiParam (body) {string} status Status enum : pending, approved, disapproved
   * @apiParam (body) {string} [remarks] Status remarks (optional, required if status = disapproved)
   * @apiParam (body) {string} type Type of the document for which the status needs to be updated.
   *
   * @apiSuccess {String} status success
   * @apiSuccess {String} message Successfully done
   *
   * @apiSuccessExample {object} Success-Response:
   * {
   *     "status": "success",
   *     "message": "Successfully done"
   * }
   *
   * @apiErrorExample {object} NOT_FOUND
   *  HTTP/1.1 404 Not Found
   *  {
   *      "message": "User not found",
   *      "code": "NOT_FOUND",
   *      "httpCode": 404
   *  }
   * @apiErrorExample {object} VALIDATION_FAILED
   *  HTTP/1.1 422 Unprocessable Entity
   *  {
   *       "message": "\"remarks\" is required",
   *       "code": "VALIDATION_FAILED",
   *       "httpCode": 422
   *   }
   *
   */
  router.put(
    "/club-academy/:user_id/documents/status",
    checkAuthToken,
    auth.checkRole([Role.ADMIN]),
    updateStatusValidator.addUpdateStatusValidator,
    async (req, res) => {
      let { user_id } = req.params;

      let { status, remarks, type } = req.body;

      try {
        responseHandler(
          req,
          res,
          Promise.resolve(
            clubAcademyInst.updateDocumentStatus(user_id, type, status, remarks)
          )
        );
      } catch (error) {
        responseHandler(req, res, Promise.reject(e));
      }
    }
  );
};
