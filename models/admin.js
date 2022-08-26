const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
const toJson = require('@meanie/mongoose-to-json');
var findHashtags = require('find-hashtags');
const Schema = mongoose.Schema;

const AdminSchema = new Schema({
    loginId: { type: String, default: 'matt' },
    password: { type: String, default: '0p3n4m3n0w' },
    date: { type: Date, default: Date.now() },
});

AdminSchema.statics.findUserById = function (loginId) {
    return this.findOne({ 'loginId': loginId }).exec();
}

AdminSchema.index({ hashTags: 1 });
AdminSchema.plugin(toJson);
AdminSchema.plugin(uniqueValidator);
AdminSchema.plugin(timestamps);
module.exports = mongoose.model('Admin', AdminSchema);