const mongoose = require('mongoose');
const bcrypt = require('bcrypt-nodejs');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
const SALT_WORK_FACTOR = 10;
const Schema = mongoose.Schema;
const Room = require('./room');
var validateEmail = function (email) {
    var re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return re.test(email)
};

const UserSchema = new Schema({
    type: { type: Number, required: true }, //  1: email , 2: gmail , 3: facebook
    o_auth: {
        facebook: {
            id: String,
            access_token: String
        },
        google: {
            id: String,
            access_token: String
        },
        nn_network: {
            id: String,
            credit_id: String,
            credit_key: String,
            credit_balance: Number,
            access_token: String
        }
    },
    password: { type: String },
    username: { type: String, required: true, unique: true },
    phone: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    name: { type: String, default: '' },
    gender: { type: Number, default: 2 }, //1: Male , 0: Female, 2: None
    age: { type: Number, default: 0 },
    bio: { type: String, default: '' },
    website: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isFlagged: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isNewUser: { type: Boolean, default: false },
    isFollowing: { type: Boolean, default: false },
    showNotification: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    showActivity: { type: Boolean, default: false },
    allowSharing: { type: Boolean, default: false },
    fcm_token: {type: String, default: ''},
    email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
    },
    followFee: { type: Number, default: 0},
});

// UserSchema.pre('save', function (next) {
//     const user = this;
//     if (user.type === 1) {
//         bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
//             if (err) return next(err);
//             bcrypt.hash(user.password, salt, function (err, hash) {
//                 if (err) return next(err);
//                 user.password = hash;
//                 next();
//             });
//         });
//     }
// });

UserSchema.methods.validPassword = function (password) {
    return bcrypt.compareSync(password, this.password);
};

/**
 * Static
 */

UserSchema.statics.findUserById = function (userId) {
    return this.findById(userId).exec();
}

UserSchema.statics.getAll = async function () {

    return this.find({}).exec();
}

UserSchema.statics.findUser = async function (username) {

    return this.findOne({ 'username': username }).exec();
}

UserSchema.statics.unregister = function (UserSchemaId) {

    return this.remove({ _id: UserSchemaId }).exec();
}

UserSchema.statics.findUserByEmail = function (email) {
    return this.findOne({ 'email': email }).exec();
}

UserSchema.statics.findUserByFacebookId = function (id) {
    return this.findOne({ 'o_auth.facebook.id': id });
}

UserSchema.statics.findUserByGoogleId = function (id) {
    return this.findOne({ 'o_auth.google.id': id });
}

UserSchema.statics.findUserByNN = function (id) {
    return this.findOne({ 'o_auth.nn_network.id': id });
}

UserSchema.statics.updateUserById = function (userId, params) {
    return this.findByIdAndUpdate(userId, { $set: params }, { new: true })
        .lean()
        .exec();
}

UserSchema.statics.removeCurrentAvatar = function (userId) {
    return this.findByIdAndUpdate(userId, { avatar: null }, { new: true })
        .lean()
        .exec();
};

UserSchema.statics.updateCurrentAvatar = function (userId, picUrl) {
    return this.findByIdAndUpdate(userId, { avatar: picUrl }, { new: true })
    .lean()
    .exec();
};

UserSchema.statics.populateByFollowers = function (myId) {
    return this.find({ '_id': { $ne: myId } })
    .limit(20)
    .sort({'createdAt': -1})
    .exec();
};

UserSchema.statics.getRooms =   function (userId, start, count, searchText = '') {
    let sort_object=  '';
    let sub_query = [
        {
            $match: {
                $and:[
                    {"username": { $regex : searchText, $options: 'i'  }},
                    {'_id': {$ne:  mongoose.Types.ObjectId(userId)}}
                ]
             },
        },
        {
            $lookup: {
                from: 'rooms',
                let: {'id_field': "$_id"},
                pipeline: [{
                    $match: {
                        $expr:
                            {
                            $or: [
                                {
                                    $and: [
                                        {
                                            'group' : {$exists: true, $in: [ mongoose.Types.ObjectId(userId)]}
                                        },
                                    ]

                                },
                                {
                                    $and: [
                                        {$eq: ['$participant1', mongoose.Types.ObjectId(userId)]}
                                    ]
                                }
                            ],
                        },
                    }
                }
                ],
                as: "joined_room"
            }
        },
        {
            $unwind: {
                path: '$joined_room',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $group: {
                "_id": "$username","doc": {"$first": "$$ROOT"}}},
        {"$replaceRoot":{"newRoot":"$doc"}}
    ];
    if(searchText.trim() != '')
        sort_object = {
            'username': 1
        }
    else
        sort_object = {
            'joined_room.lastActiveDate': -1
        }
    return this.aggregate(sub_query).sort(sort_object).limit(20);

},

UserSchema.statics.getBySearchWithUsername = async function (search, start, count, excepting_users = []) {

    if ( search == "" ) {
        return this.find({ '_id': { "$nin": excepting_users}})
            .sort({'username': -1})
            .skip(start)
            .limit(count)
            .lean()
            .exec();
    } 
    return this.find(
        {
            $and: [
                    {"username": { $regex : search, $options: 'i'  }}
                ]
        })
        .sort({'username': -1})
        .skip(start)
        .limit(count)
        .lean()
        .exec();
}

UserSchema.statics.getUsersByMultiple = function(users) {
    return this.find({ _id: { $in: users }});
}

UserSchema.statics.updateNNValue = function(userId, credit_id, credit_key, credit_balance,socialId){
    return this.findByIdAndUpdate(userId,
        { o_auth: {
                nn_network: {
                    id: socialId,
                    credit_id:credit_id,
                    credit_key:credit_key,
                    credit_balance:credit_balance,
                }
            } },
        { new: true })
        .lean()
        .exec();
}


UserSchema.plugin(uniqueValidator);
UserSchema.plugin(timestamps);
module.exports = mongoose.model('User', UserSchema);
