const LocationService = require('../services/LocationService');
const responseHandler = require('../ResponseHandler');
const { checkAuthToken, checkRole } = require('../middleware/auth');
const locationValidator = require("../middleware/validators").locationValidator;

module.exports = (router) => {

    /**
     * @api {get} /master/city/all get all cities
     * @apiName city listing
     * @apiGroup City
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": [{
     *         "id":"1",
     *         "name":"Bombuflat",
     *         "state_id":"1"
     *       }]
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
    router.get("/master/city/all", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getAllCities());
    });

    /**
     * @api {get} /master/city/byId/:id get city by city id
     * @apiName city Details
     * @apiGroup City
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": {
     *         "id":"1",
     *         "name":"Bombuflat",
     *         "state_id":"1"
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
     *
     */
    router.get("/master/city/byId/:id", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getCityById(req.params.id));
    });

    /**
     * @api {get} /master/city/byStateID/:stateId get city by state id
     * @apiName city listing by state
     * @apiGroup City
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": [{
     *         "id":"1",
     *         "name":"Bombuflat",
     *         "state_id":"1"
     *       }]
     *     }
     *
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
    router.get("/master/city/byStateID/:stateId", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getCitiesByStateId(req.params.stateId));
    });

    /**
     * @api {get} /master/state/all get all states
     * @apiName state listing
     * @apiGroup State
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": [{
     *         "id":"1",
     *         "name":"Andaman and Nicobar Islands",
     *         "country_id":"101"
     *       }]
     *     }
     *
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
    router.get("/master/state/all", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getAllStates());
    });

    /**
     * @api {get} /master/state/byId/:id get state by state id
     * @apiName state Details
     * @apiGroup State
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": {
     *         "id":"1",
     *         "name":"Andaman and Nicobar Islands",
     *         "country_id":"101"
     *       }
     *     }
     *
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
    router.get("/master/state/byId/:id", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getStateById(req.params.id));
    });

    /**
     * @api {get} /master/state/byCountryId/:countryId get state by country id
     * @apiName state listing by country
     * @apiGroup State
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": [{
     *         "id":"1",
     *         "name":"Andaman and Nicobar Islands",
     *         "country_id":"101"
     *       }]
     *     }
     *
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
    router.get("/master/state/byCountryId/:countryId", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getStatesByCountryId(req.params.countryId));
    });

    /**
     * @api {get} /master/country/all get all countries
     * @apiName country listing
     * @apiGroup Country
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": [{
     *         "id":"1",
     *         "sortname":"AF",
     *         "name":"Afghanistan",
     *         "phonecode":"93"
     *       }]
     *     }
     *
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
    router.get("/master/country/all", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getAllCountries());
    });

    /**
     * @api {get} /master/country/byId/:id get country by country id
     * @apiName country Details
     * @apiGroup Country
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": {
     *         "id":"1",
     *         "sortname":"AF",
     *         "name":"Afghanistan",
     *         "phonecode":"93"
     *       }
     *     }
     *
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
    router.get("/master/country/byId/:id", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getCountryById(req.params.id));
    });

    /**
     * @api {get} /master/country/byCode/:code get country by country code
     * @apiName country listing by country code
     * @apiGroup Country
     *
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": {
     *         "id":"1",
     *         "sortname":"AF",
     *         "name":"Afghanistan",
     *         "phonecode":"93"
     *       }
     *     }
     *
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
    router.get("/master/country/byCode/:code", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getCountryByCountryCode(req.params.code));
    });

    /**
    * @api {get} /master/location/stats location stats
    * @apiName location stats
    * @apiGroup Location
    * 
    * @apiSuccess {String} status success
    * @apiSuccess {String} message Successfully done
    *
    * @apiSuccessExample {json} Success-Response:
    *     HTTP/1.1 200 OK
    *     {
    *       "status": "success",
    *       "message": "Successfully done",
    *       "data": [ {
    *                  "country": "India",
    *                  "no_of_state": 10,
    *                  "no_of_city": 10 }
    *               ]
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

    router.get("/master/location/stats", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getLocationStats());
    });

    /**
     * @api {post} /master/state/add add state
     * @apiName add state
     * @apiGroup Location
     *
     * @apiParam (body) {String} name state name
     * 
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done"
     *     }
     *
     *
     * @apiErrorExample {json} INTERNAL_SERVER_ERROR:
     *     HTTP/1.1 500 Internal server error
     *     {
     *       "message": "Internal Server Error",
     *       "code": "INTERNAL_SERVER_ERROR",
     *       "httpCode": 500
     *     }
     *
     * @apiErrorExample {json} CONFLICT
	 *     HTTP/1.1 409 Conflict
	 *     {
	 *       "message": "State already added",
     *       "code": "CONFLICT",
     *       "httpCode": 409
	 *     }
     *
     */

    router.post("/master/state/add", checkAuthToken, checkRole(["admin"]), locationValidator.addStateAPIValidation, function (req, res) {
        let serviceInst = new LocationService();
        let reqObj = req.body
        return responseHandler(req, res, serviceInst.addState(reqObj));
    });

    /**
     * @api {get} /master/state/list state listing
     * @apiName state listing
     * @apiGroup Location
     * 
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done",
     *       "data": { 
     *         "total":1,
     *         "records":[
     *           {
     *             "name": "Delhi",
     *             "id": "7b2aae40-b92d-41c9-a1b5-84c0b20d9996"
     *           }
     *         ]
     *     }
     *
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

    router.get("/master/state/list", function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.getStateList());
    });

    /**
     * @api {put} /master/state/:id edit state
     * @apiName edit state
     * @apiGroup Location
     *
     * @apiParam (body) {String} name state name
     * 
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done"
     *     }
     *
     *
     * @apiErrorExample {json} INTERNAL_SERVER_ERROR:
     *     HTTP/1.1 500 Internal server error
     *     {
     *       "message": "Internal Server Error",
     *       "code": "INTERNAL_SERVER_ERROR",
     *       "httpCode": 500
     *     }
     *
     * @apiErrorExample {json} CONFLICT
	 *     HTTP/1.1 409 Conflict
	 *     {
	 *       "message": "State already added",
     *       "code": "CONFLICT",
     *       "httpCode": 409
	 *     }
     *
     * @apiErrorExample {json} NOT_FOUND
     *     HTTP/1.1 404 Not found
     *     {
     *       "message": "State not found",
     *       "code": "NOT_FOUND",
     *       "httpCode": 404
     *     }
     * 
     */

    router.put("/master/state/:id", checkAuthToken, checkRole(["admin"]), locationValidator.addStateAPIValidation, function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.editState({ reqObj: req.body, id: req.params.id }));
    });

    /**
     * @api {post} /master/city/add/:state_id add city
     * @apiName add city
     * @apiGroup Location
     *
     * @apiParam (body) {String} name city name
     * 
     * @apiSuccess {String} status success
     * @apiSuccess {String} message Successfully done
     *
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     {
     *       "status": "success",
     *       "message": "Successfully done"
     *     }
     *
     *
     * @apiErrorExample {json} INTERNAL_SERVER_ERROR:
     *     HTTP/1.1 500 Internal server error
     *     {
     *       "message": "Internal Server Error",
     *       "code": "INTERNAL_SERVER_ERROR",
     *       "httpCode": 500
     *     }
     *
     * @apiErrorExample {json} CONFLICT
	 *     HTTP/1.1 409 Conflict
	 *     {
	 *       "message": "City already added",
     *       "code": "CONFLICT",
     *       "httpCode": 409
	 *     }
     *
     * @apiErrorExample {json} NOT_FOUND
     *     HTTP/1.1 404 Not found
     *     {
     *       "message": "State not found",
     *       "code": "NOT_FOUND",
     *       "httpCode": 404
     *     }
     * 
     */

    router.post("/master/city/add/:state_id", checkAuthToken, checkRole(["admin"]), function (req, res) {
        let serviceInst = new LocationService();
        return responseHandler(req, res, serviceInst.addCity({ reqObj: req.body, state_id: req.params.state_id }));
    });
};
