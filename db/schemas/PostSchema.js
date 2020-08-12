const uuidv4 = require("uuid/v4");
const POST_TYPE = require("../../constants/PostType");
const POST_MEDIA = require("../../constants/PostMedia");
const POST_STATUS = require("../../constants/PostStatus");

module.exports = {
  fields: {
    id: {
      type: String,
      required: true,
      default: function () {
        return uuidv4();
      },
    },
    posted_by: {
      type: String,
    },
    media: {
      text: {
        type: String,
      },
      media_url: {
        type: String,
      },
      media_thumbnail: {
        type: String,
      },
      media_type: {
        type: String,
        enum: POST_MEDIA.ALLOWED_MEDIA_TYPES,
      },
    },
    status: {
      type: String,
      enum: POST_STATUS.AVAILABLE_POST_STATUS,
    },
    post_type: {
      type: String,
      enum: POST_TYPE.ALLOWED_POST_TYPES,
      default: POST_TYPE.TIMELINE,
    },
    meta: {
      abilities: [
        {
          abilities_id: String,
          abilities_name: String,
          attributes: [{ attributes_id: String, attributes_name: String }],
        },
      ],
    },
    created_at: {
      type: Date,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    deleted_at: {
      type: Date,
    },
    updated_at: {
      type: Date,
    },
  },

  schemaName: "posts",

  options: {
    timestamps: true,
  },
};
