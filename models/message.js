var mongoose = require('mongoose');
const toJson = require('@meanie/mongoose-to-json');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
const RoomSchema = mongoose.model('Room');
var Schema = mongoose.Schema;
const type = "text photo video audio".split(' ');
const status = "sent, received, read, failed".split(' ')


const MessageSchema = new Schema({
    room: { type: Schema.Types.ObjectId, ref: 'Room' },
    message: { type: String },
    media: { type: String },
    short_url: { type: String },
    status: { type: Number }, //  1:sent , 2:received, 3:read, 4:failed
    identifier: { type: String },
    message_type: { type: Number, default: 1 }, //  1:text , 2:photo, 3:video, 4:audio
    thumb_url: { type: String },
    from: { type: Schema.Types.ObjectId, ref: 'User' },
    to: { type: Schema.Types.ObjectId, ref: 'User' },
    flaged: { type: Boolean, default: false },
    private: { type: Boolean, default: true },
    date: { type: Date, default: Date.now() },
    isDeleted1: { type: Boolean, default: false },
    isDeleted2: { type: Boolean, default: false },
    seen: { type: [Schema.Types.ObjectId], default: [] },
    postMediaFee: {type: Number, default: 0},
    purchaseList: [
        {
            type: String
        }
    ],
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

MessageSchema.statics.checkMessageExist = function (participant1, participant2) {
    return this.findOne({
        $or: [{ from: participant1, to: participant2 }, { from: participant2, to: participant1 }]
    }).exec();
}

MessageSchema.statics.getMessagesByRoomId = function (userId, roomId,skip = 0,limit = 100) {

    return this.find({
        $and: [{
            'room': roomId
        }]
    })
        .sort({ "date": -1 })
        .populate('from','avatar _id username fcm_token')
        .populate({
            path: 'room',
            populate: { path: 'group' }
        })
        .exec()
}

MessageSchema.statics.setReadMessage = function(messageId,uids = '') {

    if(!Array.isArray(messageId)){
        return this.findByIdAndUpdate(messageId, { 'status': 3 })
            .lean()
            .exec();
    }

    else if(uids) {
        return this.update(
            {
                _id: {$in : messageId}
            },
            { $push: { seen: uids } },
            {multi: true}
        ).lean().exec();
    }
}


// MessageSchema.statics.write = function({ room, message = "", media = "", message_type, thumb_url, from, to, identifier, status = "sent", date = Date.now() }) {
//     var flaged = false;
//     var private = true;
//     //var date = Date.now();
//     const msg = new this({
//         room,
//         message,
//         media,
//         // short_url: shortid.generate(),
//         status,
//         identifier,
//         message_type,
//         thumb_url,
//         from,
//         to,
//         flaged,
//         private,
//         date
//     });

//     return msg.save();
// }

MessageSchema.statics.createNewMessage = function (from, to, roomId, message = "", media = "", message_type, postMediaFee =0) {
    let data = {};
    data['from'] = from;
    data['to'] = to;
    data['room'] = roomId;
    data['message'] = message;
    data['media'] = media;
    data['message_type'] = message_type;
    data['date'] = Date.now();
    data['status'] = 1;
    data['postMediaFee'] = postMediaFee;
    let _data = JSON.stringify(data);
    const msg = new this(data);

    return msg.save();
};

MessageSchema.statics.getNewReceivedMessages = function (userId, roomId, lastSeendDate) {
    return this.find({
        $and: [
            { 'room': roomId },
            { 'isDeleted2': { $ne: true } },
            // { 'status': { $lt: 3 } },
            // { 'createdAt': { $gt: lastSeendDate } },
            { from : { $ne : userId}, },
            { seen : { $nin : [userId]}}
        ]
    })
        .sort({ _id: -1 })
        .exec();
}

MessageSchema.statics.getLastMessages = function ({ to }) {
    return this.find({
        $and: [
            { to }, { 'isDeleted2': { $ne: true } }
        ]
    })
        .populate('from', 'username  common_profile.avatar.thumb  common_profile.hexagonAvatar.thumb')
        .sort({ _id: -1 })
        .limit(10)
        .exec();
}

MessageSchema.statics.getUberRides = function () {
    return this.count({ 'message_type': 4 }).exec();
}

MessageSchema.statics.getNewMessages_ = function (userId, roomId, lastMessage) {
    return this.find({
        $and: [{
            'room': roomId
        }, {
            $or: [{
                $and: [{ 'from': userId }, { 'isDeleted1': { $ne: true } }]
            }, {
                $and: [{ 'to': userId }, { 'isDeleted2': { $ne: true } }]
            }]
        }, { 'date': { $gt: lastMessage } }]
    })
        .sort({ "_id": -1 })
        .populate('from')
        .populate('to')
        .exec()
}

MessageSchema.statics.getLongUrl = function (short_url) {

    return this.findOne({ short_url: short_url })
        .exec();
}

MessageSchema.statics.getRecents = function (userId, roomId) {

    return this.find({
        $and: [{
            'room': roomId
        }, {
            $or: [{
                $and: [{ 'from': userId }, { 'isDeleted1': { $ne: true } }]
            }, {
                $and: [{ 'to': userId }, { 'isDeleted2': { $ne: true } }]
            }]
        }]
    })
        .sort({ "_id": -1 })
        .populate('from')
        .populate('to')
        .limit(10)
        .exec()
}

MessageSchema.statics.getAllMediaOfUser = function (userId) {

    return this.find({
        $and: [{ to: userId }, { message_type: 1 }, { 'isDeleted2': { $ne: true } }]
    })
        .populate('from', 'username  common_profile.avatar.thumb  common_profile.hexagonAvatar.thumb')
        .populate('room')
        .sort({ _id: -1 })
        .exec();
}

MessageSchema.statics.flagMessage = function (messageId) {

    return this.findByIdAndUpdate(messageId, { flaged: true })
        .lean()
        .exec();
}

MessageSchema.statics.deleteMessage = function (messageId) {

    return this.remove({
        $or: [
            { _id: messageId }
        ]
    });
}

MessageSchema.statics.clearAllMessages = function (userId, roomId) {

    this.update({
        $and: [{ 'room': roomId }, { 'to': userId }]
    }, {
        'isDeleted2': true
    }, { "multi": true }).lean().exec();

    return this.update({
        $and: [{ 'room': roomId }, { 'from': userId }]
    }, {
        'isDeleted1': true
    }, { "multi": true })
        .lean()
        .exec();
}

MessageSchema.statics.setDeletedMessage = function (userId) {

    return this.update({ 'from': userId }, {
        $set: {
            'message': 'This content has been removed because the user has been deleted',
            'message_type': 0
        }
    }, { "multi": true })
        .lean()
        .exec();
}


MessageSchema.statics.updateMessageStatus = function (messageId, status) {

    return this.findByIdAndUpdate(messageId, { status: status })
        .lean()
        .exec();
}

MessageSchema.statics.deleteMessageByRoomId = function(roomId){
    return this.findOne({
        'room': roomId
    }).remove().exec();
}

MessageSchema.statics.getUnreadMsgCount =async function(userId){
    let room_id = [];
    const room  = await RoomSchema.find({
        $or: [{
            participant1: userId
        }, {
            group : { $in : [userId]}
        }]
    }).lean().exec();
    if(!room) return 0;
    for(const r of room) {
        room_id.push(r._id);
    }
    const msg_count = await this.count({
        from: {$ne : userId},
        seen: {$nin : userId},
        room: {$in : room_id}
    }).exec();
    return msg_count;
}

MessageSchema.statics.insertPurchase = async function(mid, to){
    const msgPurchase = this.findOneAndUpdate(
        { _id: mid },
        { $push: { purchaseList: to } },
    ).lean().exec();
    return msgPurchase;
}

MessageSchema.plugin(toJson);
MessageSchema.plugin(uniqueValidator);
MessageSchema.plugin(timestamps);
module.exports = mongoose.model('Message', MessageSchema);
