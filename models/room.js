var mongoose = require('mongoose');
const toJson = require('@meanie/mongoose-to-json');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
var Schema = mongoose.Schema;

const Room = new Schema({
    participant1: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participant2: { type: Schema.Types.ObjectId, ref: 'User'},
    lastMessage: { type: String },
    lastMessage_type: { type: Number, default: 1 }, //  1:text , 2:photo, 3:video
    isFriend: { type: Boolean, default: false },
    lastSeenDateOfPart1: { type: Date, default: Date.now() },
    lastSeenDateOfPart2: [
        {
            id: {type : Schema.Types.ObjectId},
            seenDate: {type: Date, default: Date.now()}
        }
    ],
    lastActiveDate: { type: Date, default: Date.now() },
    group: [{
        type: Schema.Types.ObjectId,
        ref: 'User' }],
    direct : {type: Boolean, default: true},
    name: {type : String, default: ''}
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

Room.statics.createRoom = function( participant1, participant2, message, message_type ) {
    let data = {};
    let seen_date2 = [];
    data['participant1'] = participant1;
    data['group'] = participant2;
    data['lastMessage'] = message;
    data['lastMessage_type'] = message_type;
    data['lastSeenDateOfPart1'] = Date.now();
    data['lastActiveDate'] = Date.now();
    for(let uid2 of participant2){
        seen_date2.push({
            id: uid2,
            seenDate: Date.now()
        })
    }
    data['lastSeenDateOfPart2'] = seen_date2;
    const room = new this(data);
    return room.save().then(t => t.populate('participant1', 'avatar _id username').populate('group','avatar _id username').execPopulate());
}

Room.statics.deleteRoom = function(roomId){
    return this.findOne({
        '_id': roomId,
    })
        .remove()
        .exec();
}

Room.statics.checkRoomExist = function(participant1, participant2, roomId=  '', type = true) {
    if(type) {
        if(roomId) {
            return this.findOne({
                '_id': roomId,
            })
                .populate('participant1','fcm_token _id')
                .populate('group','fcm_token _id')
                .exec();
        }
        else{
            return this.findOne({
                $or: [{ group: { $all : participant2} }]
            }).exec();
        }
    }

    else{
        return this.findOne({
            $or: [{ group: {$exists: true, $in: [participant1]} }, {participant1: participant1}]
        })
           .exec();
    }
}

Room.statics.oneRoom = function(participant1, participant2) {
    return this.findOne({
        $or: [
                {
                    $and:[
                        {group: { $all : participant2}},
                        {participant1: participant1}
                    ]
                },
                {
                    $and:[
                        {group: { $all : participant1}},
                        {participant1: participant2}
                    ]
                }
             ]
    })  .populate('participant1', 'username  avatar')
        .populate('group', 'username avatar o_auth _id').exec();
}

Room.statics.getRooms =async function(userId, start, count, searchText = '') {
    const regex = /[A-Za-z0-9]/g;
    let rooms =await this.find({
            $or: [{ participant1: userId }, { group : {$exists: true, $in: [userId]} }]
        })
        .populate('participant1', 'username  avatar')
        .populate('group', 'username avatar o_auth _id')
        .skip(start)
        .sort({ "lastActiveDate": -1 })
        .limit(count)
        .exec();

    if(searchText.trim() == ''){
        return rooms;
    }
    else{
        rooms = rooms.filter(room=>{
            let filtered_group = room.group.filter(g => {
                if(g.username.toLowerCase().includes(searchText.trim().toLowerCase())) {
                    return g;
                }
            });
            if( filtered_group.length > 0 ||
                room.name.includes(searchText.trim().toLowerCase()) ||
                room.participant1.username.includes(searchText.trim().toLowerCase())){
                return room;
            }
        });
        return rooms;
    }
}

Room.statics.getRoom = function(roomId) {
    return this.find({ _id: roomId })
        .populate('participant1', 'username  avatar')
        .populate('group','username avatar _id')
        .exec();
}

Room.statics.getMyAllRooms = function(userId) {
    return this.find({
            $or: [{ participant1: userId }, { participant2: userId }]
        })
        .populate('participant1', 'username  avatar')
        .populate('participant2', 'username  avatar')
        .sort({ "lastActiveDate": -1 })
        .exec();
}

Room.statics.updateRoomById  = function(roomId,param){
    return this.findOneAndUpdate({_id: roomId}, param)
        .populate('group','username avatar _id')
        .lean()
        .exec();
}

Room.statics.updateRoom = function(roomId, isParticipant1, message, message_type, userId = '') {
    if (isParticipant1) {
        return this.findOneAndUpdate({ _id: roomId }, {
                lastMessage: message,
                lastMessage_type: message_type,
                lastActiveDate: Date.now(),
                lastSeenDateOfPart1: Date.now()
            })
            .populate('participant1', '_id  fcm_token')
            .populate('group','_id fcm_token')
            .lean()
            .exec();
    } else {
        return this.findOneAndUpdate({ _id: roomId, 'lastSeenDateOfPart2.id': userId }, {
                lastMessage: message,
                lastMessage_type: message_type,
                lastActiveDate: Date.now(),
                $set: {
                    "lastSeenDateOfPart2.$.seenDate": Date.now(),
                }
            })
            .lean()
            .exec();
    }
}

Room.plugin(toJson);
Room.plugin(uniqueValidator);
Room.plugin(timestamps);
module.exports = mongoose.model('Room', Room);
