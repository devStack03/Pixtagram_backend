var mongoose = require('mongoose');
const toJson = require('@meanie/mongoose-to-json');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
var Schema = mongoose.Schema;
const type = "text photo video audio".split(' ');
const status = "sent, received, read, failed".split(' ')


const NotificationSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    postId: { type: Schema.Types.ObjectId, ref: 'Post' },
    read: { type: Boolean, default: false },
    type: { type: Number },
    date: { type: Date, default: Date.now() },

}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

NotificationSchema.statics.getAll = function (start, count,userId) {
    return this.find({
        userId: userId
    })
        .populate('sender')
        .sort({ createdAt: -1 })
        .skip(start)
        .limit(count)
        .lean()
        .exec();
}

NotificationSchema.statics.createNewNotification = function (userId,type,post,sender) {
    let data = {};
    data['sender'] = sender;
    data['userId'] = userId;
    data['type'] = type;
    data['postId'] = post;
    data['date'] = Date.now();
    data['read'] = false;
    const noti = new this(data);
    return noti.save();
};

NotificationSchema.statics.deleteNotification = function (userId,type,post) {
    return this.find({
        userId: userId,
        type: type,
        postId: post
    })
        .remove()
        .exec();
};

NotificationSchema.statics.updateNotification = function (userId) {
    return this.update({ 'userId': userId },
       { "read": true },{ "multi": true })
        .lean()
        .exec();
};

NotificationSchema.statics.removeNotification = function (userId) {
    return this.find({
        userId: userId
    })
        .remove()
        .exec();
};


NotificationSchema.plugin(toJson);
NotificationSchema.plugin(timestamps);
module.exports = mongoose.model('Notification', NotificationSchema);
