const Joi = require('@hapi/joi');
const errors = require("../../errors");
const responseHandler = require("../../ResponseHandler");
const MEMBER = require('../../constants/MemberType');
const TYPE = require('../../constants/ClubAcademyType');
const PLAYER = require('../../constants/PlayerType');
const STRONG_FOOT = require('../../constants/StrongFoot');
const SORT_ORDER = require('../../constants/SortOrder');
const PROFILE = require('../../constants/ProfileStatus');
const EMAIL_VERIFIED = require('../../constants/EmailVerified');
class UserValidator {

    async createAPIValidation(req, res, next) {
        const schema = Joi.object().keys({
            "state": Joi.string().required(),
            "country": Joi.string().required(),
            "phone": Joi.string().regex(/^[0-9]{10}$/).error(() => {
                return {
                    message: 'Invalid phone number',
                };
            }),
            "member_type": Joi.string().valid(MEMBER.PLAYER, MEMBER.CLUB, MEMBER.ACADEMY).required(),
            "name": Joi.string().min(1).regex(/^(?:[0-9]+[ a-zA-Z]|[a-zA-Z])[a-zA-Z0-9 ]*$/).error(() => {
                return {
                    message: 'Invalid name',
                };
            }),
            "first_name": Joi.string().min(1).regex(/^(?:[0-9]+[ a-zA-Z]|[a-zA-Z])[a-zA-Z0-9 ]*$/).error(() => {
                return {
                    message: 'Invalid first name',
                };
            }),
            "last_name": Joi.string().min(1).regex(/^(?:[0-9]+[ a-zA-Z]|[a-zA-Z])[a-zA-Z0-9 ]*$/).error(() => {
                return {
                    message: 'Invalid last name',
                };
            }),
            "email": Joi.string().email({ minDomainSegments: 2 }).required()
        });

        try {
            await Joi.validate(req.body, schema);
            return next();
        } catch (err) {
            console.log(err.details);
            return responseHandler(req, res, Promise.reject(new errors.ValidationFailed(err.details[0].message)));
        }
    }

    async updateDetailsAPIValidation(req, res, next) {
        const academySchema = Joi.object().keys({
            "name": Joi.string().trim().min(1).required().regex(/^(?:[0-9]+[ a-zA-Z]|[a-zA-Z])[a-zA-Z0-9 ]*$/).error(() => {
                return {
                    message: 'Invalid name',
                };
            }),
            "founded_in": Joi.number().min(1).required(),
            "country": Joi.string().trim().min(1).required(),
            "city": Joi.string().trim().required(),
            "phone": Joi.string().regex(/^[0-9]{10}$/).error(() => {
                return {
                    message: 'Invalid phone number',
                };
            }),

            "short_name": Joi.string().trim().allow(""),
            "pincode": Joi.string().trim().allow(""),
            "address": Joi.string().trim().allow(""),
            "stadium_name": Joi.string().trim().allow(""),
            "document_type": Joi.string().trim().allow(""),
            "type": Joi.string().trim().valid(TYPE.RESIDENTIAL, TYPE.NON_RESIDENTIAL).required(),
            "number": Joi.string().trim(),
            "reg_number": Joi.string().trim(),
            "associated_players": Joi.number().allow(""),
            "head_coach_name": Joi.string().trim().allow(""),
            "head_coach_email": Joi.string().trim().email({ minDomainSegments: 2 }).allow(""),
            "head_coach_phone": Joi.string().trim().allow(""),

            "league": Joi.string().trim().min(1),
            "league_other": Joi.string().trim().min(1),
            "association": Joi.string().trim().min(1),
            "association_other": Joi.string().trim().min(1),

            "owner": Joi.string(),
            "manager": Joi.string(),
            "top_signings": Joi.string(),
            "contact_person": Joi.string(),
            "trophies": Joi.string(),
            "top_players": Joi.string(),

            // need to remove
            "document": Joi.any(),
            "aiff": Joi.any()

        });
        if (req.body.document_type) {
            let document_type = req.body.document_type;
            if (document_type === 'pan') {
                academySchema.number = Joi.string().min(10).max(10).regex(/^[A-Z]{5}[0-9]{4}[A-Z]/).error(() => {
                    return {
                        message: 'Invalid pan number',
                    };
                })
            }
            if (document_type === 'coi') {
                academySchema.number = Joi.string().regex(/^[a-z-A-Z0-9]+$/).error(() => {
                    return {
                        message: 'Invalid coi number',
                    };
                })
            }
            if (document_type === 'tin') {
                academySchema.number = Joi.string().min(9).max(12).regex(/^\d+$/).error(() => {
                    return {
                        message: 'Invalid tin number',
                    };
                })
            }
        }

        let playerRule = {
            "player_type": Joi.string().trim().min(1).valid(PLAYER.GRASSROOT, PLAYER.AMATEUR, PLAYER.PROFESSIONAL).required(),
            "first_name": Joi.string().trim().min(1).max(500).required().regex(/^(?:[0-9]+[ a-zA-Z]|[a-zA-Z])[a-zA-Z0-9 ]*$/).error(() => {
                return {
                    message: 'Invalid first name',
                };
            }),
            "last_name": Joi.string().trim().min(1).max(500).required().regex(/^(?:[0-9]+[ a-zA-Z]|[a-zA-Z])[a-zA-Z0-9 ]*$/).error(() => {
                return {
                    message: 'Invalid first name',
                };
            }),
            "dob": Joi.string().trim().required(),
            "country": Joi.string().trim().min(1).required(),
            "state": Joi.string().trim().min(1).required(),
            "phone": Joi.string().regex(/^[0-9]{10}$/).error(() => {
                return {
                    message: 'Invalid phone number',
                };
            }),

            "position": Joi.string().required(),

            "strong_foot": Joi.string().trim().min(1).valid(STRONG_FOOT.RIGHT, STRONG_FOOT.LEFT).required(),
            "weak_foot": Joi.number().min(1).max(5),

            "city": Joi.string().trim().allow(""),
            "height_feet": Joi.string().trim().allow(""),
            'height_inches': Joi.string().trim().allow(""),
            "weight": Joi.string().trim().allow(""),

            "school": Joi.string().trim().allow(""),
            "college": Joi.string().trim().allow(""),
            "university": Joi.string().trim().allow(""),

            "head_coach_name": Joi.string().trim().allow(""),
            "head_coach_email": Joi.string().trim().email({ minDomainSegments: 2 }).allow(""),
            "head_coach_phone": Joi.string().trim().allow(""),
            "former_club": Joi.string().trim().allow(""),

            //need to remove
            "player_employment_contract": Joi.any(),
            "associated_club": Joi.string()
        };

        if (req.body.player_type === PLAYER.AMATEUR) {
            playerRule.height_feet = Joi.string().trim().required();
            playerRule.height_inches = Joi.string().trim().required();
            playerRule.city = Joi.string().trim().required();
        }

        const playerSchema = Joi.object().keys(playerRule);

        var schema = academySchema;

        if (req.authUser.member_type == MEMBER.PLAYER) {
            schema = playerSchema;
        }

        try {
            await Joi.validate(req.body, schema);
            return next();
        } catch (err) {
            console.log(err.details);
            return responseHandler(req, res, Promise.reject(new errors.ValidationFailed(err.details[0].message)));
        }
    }
    async updateBioAPIValidation(req, res, next) {
        const schema = Joi.object().keys({
            "bio": Joi.string().allow(""),
            "facebook": Joi.string().allow(""),
            "youtube": Joi.string().allow(""),
            "twitter": Joi.string().allow(""),
            "instagram": Joi.string().allow("")
        });

        try {
            await Joi.validate(req.body, schema);
            return next();
        } catch (err) {
            console.log(err.details);
            return responseHandler(req, res, Promise.reject(new errors.ValidationFailed(err.details[0].message)));
        }
    }
    async playerListQueryValidation(req, res, next) {

        const query = Joi.object().keys({
            "page_no": Joi.number(),
            "page_size": Joi.number(),
            "sort_order": Joi.number().valid([SORT_ORDER.ASCENDING, SORT_ORDER.DESCENDING]),
            "sort_by": Joi.string(),
            "from": Joi.string(),
            "to": Joi.string(),
            "search": Joi.string(),
            "email": Joi.string(),
            "name": Joi.string(),
            "position": Joi.string(),
            "type": Joi.string(),
            "profile_status": Joi.string().valid([PROFILE.VERIFIED, PROFILE.NON_VERIFIED]),
            "email_verified": Joi.string().valid([EMAIL_VERIFIED.TRUE, EMAIL_VERIFIED.FALSE]),
        })
        try {

            await Joi.validate(req.query, query);
            return next();
        } catch (err) {
            console.log(err.details);
            return responseHandler(req, res, Promise.reject(new errors.ValidationFailed(err.details[0].message)));
        }
    }
    async clubAcademyListQueryValidation(req, res, next) {

        const query = Joi.object().keys({
            "page_no": Joi.number(),
            "page_size": Joi.number(),
            "sort_order": Joi.number().valid([SORT_ORDER.ASCENDING, SORT_ORDER.DESCENDING]),
            "sort_by": Joi.string(),
            "from": Joi.string(),
            "to": Joi.string(),
            "search": Joi.string(),
            "email": Joi.string(),
            "name": Joi.string(),
            "profile_status": Joi.string().valid([PROFILE.VERIFIED, PROFILE.NON_VERIFIED]),
            "email_verified": Joi.string().valid([EMAIL_VERIFIED.TRUE, EMAIL_VERIFIED.FALSE]),
        })
        try {

            await Joi.validate(req.query, query);
            return next();
        } catch (err) {
            console.log(err.details);
            return responseHandler(req, res, Promise.reject(new errors.ValidationFailed(err.details[0].message)));
        }
    }
    async memberSearchQueryValidation(req, res, next) {

        const query = Joi.object().keys({
            "search": Joi.string().trim().min(3),
            "page_size": Joi.number(),
            "page_no": Joi.number()
        })
        try {

            await Joi.validate(req.query, query);
            return next();
        } catch (err) {
            console.log(err.details);
            return responseHandler(req, res, Promise.reject(new errors.ValidationFailed(err.details[0].message)));
        }
    }
}

module.exports = new UserValidator();

