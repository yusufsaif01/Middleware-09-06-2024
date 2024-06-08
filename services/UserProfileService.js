const config = require("../config");
const AuthUtility = require("../db/utilities/AuthUtility");
const UserUtility = require("../db/utilities/UserUtility");
const PlayerUtility = require("../db/utilities/PlayerUtility");
const CoachUtility = require("../db/utilities/CoacheUtility");
const LoginUtility = require("../db/utilities/LoginUtility");
const ClubAcademyUtility = require("../db/utilities/ClubAcademyUtility");
const errors = require("../errors");
const _ = require("lodash");
const MEMBER = require("../constants/MemberType");
const RESPONSE_MESSAGE = require("../constants/ResponseMessage");
const moment = require("moment");
const StorageProvider = require("storage-provider");
const STORAGE_PROVIDER_LOCAL = require("../constants/StorageProviderLocal");
const AADHAR_MEDIA_TYPE = require("../constants/AadharMediaType");
const DOCUMENT_MEDIA_TYPE = require("../constants/DocumentMediaType");
const DOCUMENT_TYPE = require("../constants/DocumentType");
const PROFILE_STATUS = require("../constants/ProfileStatus");
const CountryUtility = require("../db/utilities/CountryUtility");
const StateUtility = require("../db/utilities/StateUtility");
const DistrictUtility = require("../db/utilities/DistrictUtility");
const PositionUtility = require("../db/utilities/PositionUtility");
const PLAYER = require("../constants/PlayerType");
const DOCUMENT_STATUS = require("../constants/DocumentStatus");
const CONTRACT_STATUS = require("../constants/ContractStatus");
const EmploymentContractUtility = require("../db/utilities/EmploymentContractUtility");
const PROFILE_DETAIL = require("../constants/ProfileDetailType");
const userValidator = require("../middleware/validators").userValidator;
const UserRegistrationService = require("./UserRegistrationService");
const axios = require("axios");
/**
 *
 *
 * @class UserProfileService
 */
class UserProfileService {
  /**
   *Creates an instance of UserProfileService.
   * @memberof UserProfileService
   */
  constructor() {
    this.authUtilityInst = new AuthUtility();
    this.userUtilityInst = new UserUtility();
    this.playerUtilityInst = new PlayerUtility();
    this.coachUtilityInst = new CoachUtility();
    this.clubAcademyUtilityInst = new ClubAcademyUtility();
    this.countryUtilityInst = new CountryUtility();
    this.stateUtilityInst = new StateUtility();
    this.districtUtilityInst = new DistrictUtility();
    this.loginUtilityInst = new LoginUtility();
    this.employmentContractUtilityInst = new EmploymentContractUtility();
  }

  /**
   *
   *
   *
   * @param {*} data
   * @returns
   * @memberof UserProfileService
   */

  async updateProfileDetails(requestedData = {}) {
    axios
      .put(
        "https://test.yftchain.com/registration/in/update-details/:_category",
        requestedData
      )
      .then(function (response) {
        console.log(response);
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  /**
   * validates document number
   *
   * @param {*} data
   * @param {*} member_type
   * @param {*} user_id
   * @returns
   * @memberof UserProfileService
   */
  async validateDocNumber(data, member_type, user_id) {
    try {
      if (member_type !== MEMBER.PLAYER && (data.number || data.aiff_id)) {
        let documentNum = data.number ? data.number : data.aiff_id;
        const details = await this.clubAcademyUtilityInst.findOne(
          {
            member_type: member_type,
            documents: {
              $elemMatch: {
                document_number: documentNum,
              },
            },
          },
          { documents: 1, user_id: 1 }
        );
        if (!_.isEmpty(details)) {
          if (details.user_id !== user_id) {
            if (member_type === MEMBER.CLUB)
              return Promise.reject(
                new errors.Conflict(RESPONSE_MESSAGE.ID_DETAILS_EXISTS)
              );
            if (member_type === MEMBER.ACADEMY)
              return Promise.reject(
                new errors.Conflict(RESPONSE_MESSAGE.DOCUMENT_DETAILS_EXISTS)
              );
          }
        }
      }
      if (
        member_type === MEMBER.PLAYER &&
        data.aadhar_number &&
        data.aadhar_media_type
      ) {
        const details = await this.playerUtilityInst.findOne(
          {
            documents: {
              $elemMatch: {
                document_number: data.aadhar_number,
                type: DOCUMENT_TYPE.AADHAR,
              },
            },
          },
          { documents: 1, user_id: 1 }
        );
        if (!_.isEmpty(details)) {
          if (details.user_id !== user_id)
            return Promise.reject(
              new errors.Conflict(RESPONSE_MESSAGE.AADHAR_DETAILS_EXISTS)
            );
        }
      }
    } catch (e) {
      console.log("Error in validateDocNumber() of UserProfileService", e);
      return Promise.reject(e);
    }
  }

  /**
   * manages user documents
   *
   * @param {*} [reqObj={}]
   * @param {*} member_type
   * @param {*} user_id
   * @returns updated documents array
   * @memberof UserProfileService
   */
  async manageDocuments(reqObj = {}, member_type, user_id) {
    try {
      let updatedDoc = [];
      if (
        reqObj.profileStatus &&
        reqObj.profileStatus === PROFILE_STATUS.VERIFIED
      ) {
        return Promise.resolve(reqObj);
      }
      if (member_type === MEMBER.PLAYER) {
        if (!reqObj.aadhar_number) {
          return Promise.reject(
            new errors.ValidationFailed(RESPONSE_MESSAGE.AADHAR_NUMBER_REQUIRED)
          );
        }
        let details = await this.playerUtilityInst.findOne(
          { user_id: user_id },
          { documents: 1 }
        );
        let documents = details.documents || [];
        let aadharDB = _.find(documents, { type: DOCUMENT_TYPE.AADHAR });
        let aadharReqObj = _.find(reqObj.documents, {
          type: DOCUMENT_TYPE.AADHAR,
        });
        if (!aadharReqObj && !aadharDB) {
          return Promise.reject(
            new errors.ValidationFailed(
              RESPONSE_MESSAGE.AADHAR_DOCUMENT_REQUIRED
            )
          );
        }
        if (!reqObj.user_photo && !aadharDB) {
          return Promise.reject(
            new errors.ValidationFailed(RESPONSE_MESSAGE.PLAYER_PHOTO_REQUIRED)
          );
        }
        let aadharObj = aadharReqObj || aadharDB;
        aadharObj.document_number = reqObj.aadhar_number;
        aadharObj.media.user_photo =
          reqObj.user_photo || (aadharDB ? aadharDB.media.user_photo : "");
        aadharObj.status = DOCUMENT_STATUS.PENDING;
        updatedDoc.push(aadharObj);
      }
      if (member_type === MEMBER.CLUB) {
        if (!reqObj.aiff_id) {
          return Promise.reject(
            new errors.ValidationFailed(RESPONSE_MESSAGE.AIFF_ID_REQUIRED)
          );
        }
        let details = await this.clubAcademyUtilityInst.findOne(
          { user_id: user_id },
          { documents: 1 }
        );
        let documents = details.documents || [];
        let aiffDB = _.find(documents, { type: DOCUMENT_TYPE.AIFF });
        let aiffReqObj = _.find(reqObj.documents, { type: DOCUMENT_TYPE.AIFF });
        if (!aiffDB && !aiffReqObj) {
          return Promise.reject(
            new errors.ValidationFailed(RESPONSE_MESSAGE.AIFF_REQUIRED)
          );
        }
        let aiffObj = aiffReqObj || aiffDB;
        aiffObj.document_number = reqObj.aiff_id;
        aiffObj.status = DOCUMENT_STATUS.PENDING;
        updatedDoc.push(aiffObj);
      }
      if (member_type === MEMBER.ACADEMY) {
        if (reqObj.number) {
          let details = await this.clubAcademyUtilityInst.findOne(
            { user_id: user_id },
            { documents: 1 }
          );
          let documents = details.documents || [];
          let documentDB = _.find(documents, { type: reqObj.document_type });
          let documentReqObj = _.find(reqObj.documents, {
            type: reqObj.document_type,
          });
          if (!documentDB && !documentReqObj && !reqObj.document_type) {
            return Promise.reject(
              new errors.ValidationFailed(
                RESPONSE_MESSAGE.DOCUMENT_TYPE_REQUIRED
              )
            );
          }
          if (!documentDB && !documentReqObj) {
            return Promise.reject(
              new errors.ValidationFailed(RESPONSE_MESSAGE.DOCUMENT_REQUIRED)
            );
          }
          let documentObj = documentReqObj || documentDB;
          documentObj.document_number = reqObj.number;
          documentObj.status = DOCUMENT_STATUS.PENDING;
          updatedDoc.push(documentObj);
        }
        if (!reqObj.number && reqObj.documents) {
          return Promise.reject(
            new errors.ValidationFailed(
              RESPONSE_MESSAGE.DOCUMENT_NUMBER_REQUIRED
            )
          );
        }
      }
      reqObj.documents = updatedDoc;
      await this.validateDocNumber(reqObj, member_type, user_id);
      return Promise.resolve(reqObj);
    } catch (e) {
      console.log("Error in manageDocuments of UserProfileService", e);
      return Promise.reject(e);
    }
  }

  async prepareProfileData(member_type, data) {
    if (data._category === PROFILE_DETAIL.PROFESSIONAL) {
      if (member_type === MEMBER.PLAYER) {
        let club_academy_details = {
          head_coache_name: data.head_coache_name ? data.head_coache_name : "",
          head_coache_phone: data.head_coache_phone
            ? data.head_coache_phone
            : "",
          head_coache_email: data.head_coache_email
            ? data.head_coache_email
            : "",
        };
        if (!_.isEmpty(club_academy_details))
          data.club_academy_details = club_academy_details;
        if (data.position) {
          let { position } = data;
          let msg = null;
          let positionArray = [];
          for (const element of position) {
            let positionObj = {};
            if (!element.id) {
              msg = RESPONSE_MESSAGE.POSITION_ID_REQUIRED;
            }
            if (element.id) {
              let positionUtilityInst = new PositionUtility();
              const foundPosition = await positionUtilityInst.findOne(
                { id: element.id },
                { name: 1 }
              );
              if (_.isEmpty(foundPosition)) {
                msg = RESPONSE_MESSAGE.POSITION_NOT_FOUND;
              } else {
                positionObj.name = foundPosition.name;
                positionObj.id = element.id;
              }
            }
            if (!element.priority) {
              msg = RESPONSE_MESSAGE.POSITION_PRIORITY_REQUIRED;
            }
            if (element.priority) {
              positionObj.priority = element.priority;
            }
            positionArray.push(positionObj);
          }
          if (msg) {
            return Promise.reject(new errors.ValidationFailed(msg));
          }
          data.position = positionArray;
        }
      } else {
        if (data.top_signings) {
          _.remove(data.top_signings, (val) => val.name === "");
        }
      }
    }
    if (data._category === PROFILE_DETAIL.PERSONAL) {
      let social_profiles = {};

      if (data.facebook) social_profiles.facebook = data.facebook;
      if (data.youtube) social_profiles.youtube = data.youtube;
      if (data.twitter) social_profiles.twitter = data.twitter;
      if (data.instagram) social_profiles.instagram = data.instagram;
      if (data.linked_in) social_profiles.linked_in = data.linked_in;

      if (!_.isEmpty(social_profiles)) data.social_profiles = social_profiles;
      if (data.country && data.state && data.district) {
        let { country, state, district } = data;
        let foundCountry = await this.countryUtilityInst.findOne(
          { id: country },
          { name: 1 }
        );
        if (_.isEmpty(foundCountry)) {
          return Promise.reject(
            new errors.NotFound(RESPONSE_MESSAGE.COUNTRY_NOT_FOUND)
          );
        }
        let foundState = await this.stateUtilityInst.findOne(
          {
            id: state,
            country_id: country,
          },
          { name: 1 }
        );
        if (_.isEmpty(foundState)) {
          return Promise.reject(
            new errors.NotFound(RESPONSE_MESSAGE.STATE_NOT_FOUND)
          );
        }
        let foundDistrict = await this.districtUtilityInst.findOne(
          {
            id: district,
            state_id: state,
          },
          { name: 1 }
        );
        if (_.isEmpty(foundDistrict)) {
          return Promise.reject(
            new errors.NotFound(RESPONSE_MESSAGE.DISTRICT_NOT_FOUND)
          );
        }
        let countryObj = {
          id: country,
          name: foundCountry.name,
        };
        let stateObj = {
          id: state,
          name: foundState.name,
        };
        let districtObj = {
          id: district,
          name: foundDistrict.name,
        };
        data.country = countryObj;
        data.state = stateObj;
        data.district = districtObj;
      }
      if (member_type === MEMBER.PLAYER) {
        if (data.dob) {
          data.dob = moment(data.dob).format("YYYY-MM-DD");
          let userRegistrationServiceInst = new UserRegistrationService();
          data.player_type =
            await userRegistrationServiceInst.getPlayerTypeFromDOB(data.dob);
        }
        let institute = {
          school: data.school ? data.school : null,
          college: data.college ? data.college : null,
          university: data.university ? data.university : null,
        };
        let height = {
          feet: data.height_feet ? data.height_feet : null,
          inches: data.height_inches ? data.height_inches : null,
        };
        if (!_.isEmpty(institute)) data.institute = institute;
        if (!_.isEmpty(height)) data.height = height;
      } else {
        let address = {};
        if (data.address) {
          address.full_address = data.address;
        }
        if (data.pincode) {
          address.pincode = data.pincode;
        }
        if (!_.isEmpty(address)) data.address = address;
      }
    }
    return Promise.resolve(data);
  }

  async updateAvatar(requestedData = {}) {
    let res = {};
    if (requestedData.member_type == MEMBER.PLAYER) {
      await this.playerUtilityInst.updateOne(
        { user_id: requestedData.id },
        requestedData.updateValues
      );
      const { avatar_url } = await this.playerUtilityInst.findOne(
        { user_id: requestedData.id },
        { avatar_url: 1 }
      );
      res.avatar_url = avatar_url;
    } else if (requestedData.member_type == MEMBER.coache) {
      await this.coachUtilityInst.updateOne(
        { user_id: requestedData.id },
        requestedData.updateValues
      );
      const { avatar_url } = await this.coachUtilityInst.findOne(
        { user_id: requestedData.id },
        { avatar_url: 1 }
      );
      res.avatar_url = avatar_url;
    } else {
      await this.clubAcademyUtilityInst.updateOne(
        { user_id: requestedData.id },
        requestedData.updateValues
      );
      const { avatar_url } = await this.clubAcademyUtilityInst.findOne(
        { user_id: requestedData.id },
        { avatar_url: 1 }
      );
      res.avatar_url = avatar_url;
    }
    return res;
  }

  async updateProfileDetailsValidation(data, member_type, user_id) {
    const { founded_in, trophies, contact_person, top_signings, _category } =
      data;
    console.log("recive data value is =>");
    console.log(data);
    console.log("member type is =>");
    console.log(member_type);
    console.log("user_id is");
    console.log(user_id);
    if (founded_in) {
      let msg = null;
      let d = new Date();
      let currentYear = d.getFullYear();

      if (founded_in > currentYear) {
        msg = RESPONSE_MESSAGE.FOUNDED_IN_GREATER_THAN_CURRENT_YEAR;
      }
      if (founded_in < 0) {
        msg = RESPONSE_MESSAGE.FOUNDED_IN_CANNOT_BE_NEGATIVE;
      }
      if (founded_in == 0) {
        msg = RESPONSE_MESSAGE.FOUNDED_IN_CANNOT_BE_ZERO;
      }

      if (msg) {
        return Promise.reject(new errors.ValidationFailed(msg));
      }
    }
    if (trophies) {
      await userValidator.trophiesValidation({ trophies: trophies });
      let msg = null;
      let d = new Date();
      let currentYear = d.getFullYear();
      trophies.forEach((element) => {
        if (element.year > currentYear) {
          msg = RESPONSE_MESSAGE.TROPHY_YEAR_GREATER_THAN_CURRENT_YEAR;
        }
        if (element.year < 0) {
          msg = RESPONSE_MESSAGE.TROPHY_YEAR_CANNOT_BE_NEGATIVE;
        }
        if (element.year == 0) {
          msg = RESPONSE_MESSAGE.TROPHY_YEAR_CANNOT_BE_ZERO;
        }
      });
      if (msg) {
        return Promise.reject(new errors.ValidationFailed(msg));
      }
    }
    if (contact_person) {
      await userValidator.contactPersonValidation({
        contact_person: contact_person,
      });
    }
    if (top_signings) {
      await userValidator.topSigningsValidation({ top_signings: top_signings });
    }
    console.log(
      data.profileStatus &&
        member_type === MEMBER.PLAYER &&
        _category === PROFILE_DETAIL.PERSONAL
    );
    //  if (data.profileStatus && member_type === MEMBER.PLAYER && _category === PROFILE_DETAIL.PERSONAL) {
    //   if (data.profileStatus === PROFILE_STATUS.VERIFIED && data.dob) {
    //         return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.DOB_CANNOT_BE_EDITED));
    //      }
    //    if (data.profileStatus != PROFILE_STATUS.VERIFIED && !data.dob) {
    // return Promise.reject(new errors.ValidationFailed(RESPONSE_MESSAGE.DOB_REQUIRED));
    // }
    //  }
    return Promise.resolve();
  }

  getAttachmentType(fileName) {
    let attachment_type = DOCUMENT_MEDIA_TYPE.PDF;
    if (fileName) {
      let file_extension = fileName.split(".")[1] || null;
      if (file_extension && file_extension != DOCUMENT_MEDIA_TYPE.PDF) {
        attachment_type = DOCUMENT_MEDIA_TYPE.IMAGE;
      }
    }
    return attachment_type;
  }

  async uploadProfileDocuments(reqObj = {}, user_id, files = null) {
    try {
      let loginDetails = await this.loginUtilityInst.findOne(
        { user_id: user_id },
        { profile_status: 1 }
      );
      reqObj.profileStatus = loginDetails.profile_status.status;
      if (
        files &&
        reqObj.profileStatus !== PROFILE_STATUS.VERIFIED &&
        reqObj._category === PROFILE_DETAIL.DOCUMENT
      ) {
        reqObj.documents = [];
        const configForLocal = config.storage;
        let options = STORAGE_PROVIDER_LOCAL.UPLOAD_OPTIONS;
        let storageProviderInst = new StorageProvider(configForLocal);
        if (files.player_photo) {
          options.allowed_extensions =
            DOCUMENT_MEDIA_TYPE.ALLOWED_MEDIA_EXTENSIONS;
          let uploadResponse = await storageProviderInst.uploadDocument(
            files.player_photo,
            options
          );
          reqObj.user_photo = uploadResponse.url;
        }
        if (
          !reqObj.aadhar_media_type &&
          (files.aadhar || files.aadhar_front || files.aadhar_back)
        ) {
          return Promise.reject(
            new errors.ValidationFailed(
              RESPONSE_MESSAGE.AADHAR_MEDIA_TYPE_REQUIRED
            )
          );
        }
        if (reqObj.aadhar_media_type) {
          if (reqObj.aadhar_media_type === AADHAR_MEDIA_TYPE.PDF) {
            if (!files.aadhar) {
              return Promise.reject(
                new errors.ValidationFailed(
                  RESPONSE_MESSAGE.AADHAR_DOCUMENT_REQUIRED
                )
              );
            }
            if (files.aadhar) {
              options.allowed_extensions = AADHAR_MEDIA_TYPE.PDF_EXTENSION;
              let uploadResponse = await storageProviderInst.uploadDocument(
                files.aadhar,
                options
              );
              reqObj.documents.push({
                type: DOCUMENT_TYPE.AADHAR,
                added_on: Date.now(),
                media: {
                  attachment_type: AADHAR_MEDIA_TYPE.PDF,
                  document: uploadResponse.url,
                },
              });
            }
          }
          if (reqObj.aadhar_media_type === AADHAR_MEDIA_TYPE.IMAGE) {
            options.allowed_extensions =
              AADHAR_MEDIA_TYPE.ALLOWED_IMAGE_EXTENSIONS;
            let doc_front = "",
              doc_back = "";
            if (!files.aadhar_front) {
              return Promise.reject(
                new errors.ValidationFailed(
                  RESPONSE_MESSAGE.AADHAR_FRONT_REQUIRED
                )
              );
            }
            if (!files.aadhar_back) {
              return Promise.reject(
                new errors.ValidationFailed(
                  RESPONSE_MESSAGE.AADHAR_BACK_REQUIRED
                )
              );
            }
            if (files.aadhar_front) {
              let uploadResponse = await storageProviderInst.uploadDocument(
                files.aadhar_front,
                options
              );
              doc_front = uploadResponse.url;
            }
            if (files.aadhar_back) {
              let uploadResponse = await storageProviderInst.uploadDocument(
                files.aadhar_back,
                options
              );
              doc_back = uploadResponse.url;
            }
            reqObj.documents.push({
              type: DOCUMENT_TYPE.AADHAR,
              added_on: Date.now(),
              media: {
                attachment_type: AADHAR_MEDIA_TYPE.IMAGE,
                doc_front: doc_front,
                doc_back: doc_back,
              },
            });
          }
        }
        if (files.aiff) {
          options.allowed_extensions =
            DOCUMENT_MEDIA_TYPE.ALLOWED_MEDIA_EXTENSIONS;
          let uploadResponse = await storageProviderInst.uploadDocument(
            files.aiff,
            options
          );
          let attachment_type = this.getAttachmentType(files.aiff.name);
          reqObj.documents.push({
            type: DOCUMENT_TYPE.AIFF,
            added_on: Date.now(),
            media: {
              attachment_type: attachment_type,
              document: uploadResponse.url,
            },
          });
        }
        if (reqObj.document_type && files.document) {
          options.allowed_extensions =
            DOCUMENT_MEDIA_TYPE.ALLOWED_MEDIA_EXTENSIONS;
          let uploadResponse = await storageProviderInst.uploadDocument(
            files.document,
            options
          );
          let attachment_type = this.getAttachmentType(files.document.name);
          reqObj.documents.push({
            type: reqObj.document_type,
            added_on: Date.now(),
            media: {
              attachment_type: attachment_type,
              document: uploadResponse.url,
            },
          });
        }
      }

      if (reqObj.contact_person) {
        try {
          reqObj.contact_person = JSON.parse(reqObj.contact_person);
        } catch (e) {
          console.log(e);
          throw new errors.ValidationFailed(
            RESPONSE_MESSAGE.INVALID_VALUE_CONTACT_PERSONS
          );
        }
      }
      if (reqObj.trophies) {
        try {
          let trophies = JSON.parse(reqObj.trophies);
          reqObj.trophies = trophies;
        } catch (e) {
          console.log(e);
          throw new errors.ValidationFailed(
            RESPONSE_MESSAGE.INVALID_VALUE_TROPHIES
          );
        }
      }

      if (reqObj.position) {
        try {
          let position = JSON.parse(reqObj.position);
          reqObj.position = position;
        } catch (e) {
          console.log(e);
          throw new errors.ValidationFailed(
            RESPONSE_MESSAGE.INVALID_VALUE_POSITION
          );
        }
      }

      if (reqObj.top_signings) {
        try {
          let top_signings = JSON.parse(reqObj.top_signings);
          reqObj.top_signings = top_signings;
        } catch (e) {
          console.log(e);
          throw new errors.ValidationFailed(
            RESPONSE_MESSAGE.INVALID_VALUE_TOP_SIGNINGS
          );
        }
      }
      return reqObj;
    } catch (e) {
      throw e;
    }
  }
}

module.exports = UserProfileService;
