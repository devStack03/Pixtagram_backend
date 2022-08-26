const crypto = require('crypto');
const nn_network = require('../shared/constant');
const mongoose = require('mongoose');
exports.getResponseResult = (data, success, error) => {
    var result = {};
    result["data"] = data;
    result["success"] = success;
    result["error"] = error;
    return result;
};


exports.customizedUserInfo = customizedUserInfo;
exports.customizedUserInfoAdmin = customizedUserInfoAdmin;
exports.getHashHma = getHasedKey;
exports.getFollowObject = getFollowObject;
function customizedUserInfo(doc) {
    var result = {
        id: doc._id.toString(),
        type: doc.type,
        username: doc.username,
        email: doc.email,
        gender: doc.gender,
        isNewUser: doc.isNewUser,
        isFlagged: doc.isFlagged,
        isVerified: doc.isVerified,
        isDeleted: doc.isDeleted,
        firstName: doc.firstName,
        lastName: doc.lastName,
        facebookId: doc.o_auth ? doc.o_auth.facebook ? doc.o_auth.facebook.id : '' : '',
        googleId: doc.o_auth ? doc.o_auth.google ? doc.o_auth.google: '' : '',
        avatar: doc.avatar,
        age: doc.age,
        bio: doc.bio,
        website: doc.website,
        phone: doc.phone,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        isFollowing: doc.isFollowing,
        showNotification: doc.showNotification,
        isPrivate: doc.isPrivate,
        showActivity: doc.showActivity,
        allowSharing: doc.allowSharing,
        credit_balance: doc.o_auth ? doc.o_auth.nn_network ? doc.o_auth.nn_network.credit_balance ? doc.o_auth.nn_network.credit_balance : 0 : 0 : 0,
        followFee:doc.followFee? doc.followFee : 0
    };

    return result;
}

function customizedUserInfoAdmin(doc) {
    var result = {
        id: doc._id.toString(),
        username: doc.loginId,
    };

    return result;
}

function getHasedKey(hased_str,currentTimestamp){
    const hash = crypto.createHmac('sha256', nn_network.clientSecret)
        .update(currentTimestamp + '|'+ hased_str)
        .digest('hex');
    return hash;
}

function getFollowObject(userId) {
    let obj1 = {},obj2 = {}, followEnd = {};

    obj1 =  {
        '$lookup': {
            'from': 'follows', // this should be your collection name for candidates.
            'let':{'owner_field': {$toObjectId: "$owner"}, 'feedon_field' : '$feedon'},
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and : [
                                { $eq:["$follower", mongoose.Types.ObjectId(userId)] },
                                { $eq:["$followee", '$$owner_field'] },
                            ]
                        }
                    }
                }],
            'as': 'follows_u'
        }
    };
    return obj1;
}