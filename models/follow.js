const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');
const uniqueValidator = require('mongoose-unique-validator');
const Schema = mongoose.Schema;
const UserSchema = mongoose.model('User');
const Transaction = require('./transaction')

const FollowSchema = new Schema({
    followee: { type: Schema.Types.ObjectId, ref: 'User' },
    follower: { type: Schema.Types.ObjectId, ref: 'User' },
    followedAt: { type: Date, default: Date.now },
    followFee: { type: Number, default: 0},
    status: { type: Boolean, default: true},
    followEnd: {type: Date, default: null }
});

FollowSchema.statics.follow = function (followeeId, followerId,fee, update_flag = false) {
    let followEnd = null;
    let followList = {};
    if(fee > 0){
        const date = new Date()
        date.setMonth(date.getMonth() + 1)
        followEnd = date;
    }
    if(!update_flag) {
        const follow = new this({
            followee: followeeId,
            follower: followerId,
            followFee:fee,
            followedAt: new Date(),
            followEnd: followEnd
        });
        followList =  follow.save().then(t => t.populate('followee', 'avatar _id username').populate('follower','avatar _id username').execPopulate());
    }
    else{
        followList = this.findOneAndUpdate(
            {   followee: followeeId,
                follower: followerId, },
            { $set: { followFee:fee,followedAt: new Date(),followEnd: followEnd } }
        )
            .exec();
    }
    if(followList && fee > 0){
        let tran =  Transaction.insertTransaction({
            from: followerId,
            to: followeeId,
            fee: fee,
            type:'follow'
        });
    }
    return followList;
};

FollowSchema.statics.unfollow = async function (followeeId, followerId) {

    try {
        const follow = await this.findOne(
            { followee: followeeId, follower: followerId }
        ).exec();
        
            if (follow) {
                return follow.remove().then(t => t.populate('followee', 'avatar _id username').populate('follower','avatar _id username').execPopulate());
            }
        
    } catch (error) {

    }
};

FollowSchema.post('save', function(doc) {
    // send notification for following
    UserSchema.findUserById(doc.follower).then((user) => {
        if (user) {
            const msg = user.firstName + ' ' + user.lastName + ' Followed You';
            // NotificationSchema.createNotification(doc.follower, doc.followee, msg, 2, null);

            // UserSchema.findUserById(doc.followee).then((followee) => {
            //     if (followee && followee.notification && followee.notification.email) {
            //         // send email notification
            //         aws.sendNotificationEmail(followee.notification.email, followee.firstName + ' ' + followee.lastName, msg, function (err, data) {
            //             if (err) {
            //                 console.log('send notification email to ' + followee.email + ' failed');
            //             } else {
            //                 //
            //             }
            //         });
            //     }
            // });            
        }
    });
});

FollowSchema.post('remove', function (doc) {
    // send notification for unfollowing
    UserSchema.findUserById(doc.follower).then((user) => {
        if (user) {
            const msg = user.firstName + ' ' + user.lastName + ' Unfollowed You';
            // NotificationSchema.createNotification(doc.follower, doc.followee, msg, 3, null);

            // UserSchema.findUserById(doc.followee).then((followee) => {
            //     if (followee && followee.notification && followee.notification.email) {
            //         // send email notification
            //         aws.sendNotificationEmail(followee.email, followee.firstName + ' ' + followee.lastName, msg, function (err, data) {
            //             if (err) {
            //                 console.log('send notification email to ' + followee.email + ' failed');
            //             } else {
            //                 //
            //             }
            //         });
            //     }
            // });

        }
    });
});

FollowSchema.statics.checkFollow = function (followeeId, followerId) {
    return this.findOne(
        { followee: followeeId, follower: followerId }
    )
        .exec();
};

FollowSchema.statics.getFollowers = async function (followeeId,start = 0,perPage = 0) {
     let follows = this.find(
        {
            $and:[{
                followee: followeeId,
                status:true
            },
            {
                $or: [{
                    'followEnd': null
                }, {
                    $and: [{ 'followEnd': { $gte: new Date().toISOString()} }]
                }]
            }]
        }
    )
        .populate('follower', 'avatar username _id fee')
        .populate('followee' , 'avatar username _id fee')
        .select({
            follower: 1,
            followedAt: 1,
            status: 1,
            followFee: 1
        });
    if (perPage > 0) {
       follows = follows.skip(start).limit(count);
    }
    return follows;
};


FollowSchema.statics.getFollowOne = async function (followeeId,followerId) {
    return this.findOne(
        {
            $and:[{
                followee: followeeId,
                follower: followerId,
                followEnd: { $ne: null },
                followEnd: { $gte: new Date().toISOString()},
                status:true
            }]
        }
    )
        .populate('follower', 'avatar username _id')
        .populate('followee' , 'avatar username _id')
        .select({
            follower: 1,
            followedAt: 1,
            status: 1,
            followFee: 1
        })
        .lean()
        .exec();
};

FollowSchema.statics.getFollowList = async function(followerId, start = 0, perPage = 0, followType , username  =""){
    let current_time = new Date().toISOString();
    let follower = {followee: mongoose.Types.ObjectId(followerId),status:true};
    let u_condition = { $eq:["$_id", "$$follower"] };
    if(followType == 1){
        follower = {follower: mongoose.Types.ObjectId(followerId),status:true};
        u_condition = { $eq:["$_id", "$$followee"] };
    }
    let u_contition_name = {};
    if(username.trim() != ""){
        u_contition_name = {
            $regexMatch:{
                input: "$username",
                regex: "$$regex",
                options: "i"
            }
        };
    }
    let followList = await this.aggregate([
        {
            "$match": {
                $and : [
                    follower
                    // {
                    //     $or: [
                    //         {followEnd: null},
                    //         {followEnd: { $gt: current_time} }
                    //     ]
                    // }
                ]
            },
        },
        {
            '$lookup': {
                'from': 'users', // this should be your collection name for candidates.
                'let':{'followee': {$toObjectId: "$followee"}, 'follower' : {$toObjectId: "$follower"}, regex: username.trim(),'followEnd': '$followEnd'},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    u_contition_name,
                                    u_condition,
                                    {
                                        $or: [
                                            {$eq: ['$$followEnd', null]},
                                            {$gt : ['$$followEnd', current_time]}
                                        ]
                                    }
                                ]
                            }
                        }
                    }],
                'as': 'follows_u'
            }
        },
        {
            $unwind: {
                path: '$follows_u',
                preserveNullAndEmptyArrays: false
            }
        },
        { "$sort": { "follows_u.username": 1} },
        { "$limit": start + perPage },
        { "$skip": start },
     ]);
    if(followType != 1){
        return this.populate(followList,[
            {
                path:'follower',
                select:'avatar _id username fee'
            }
        ]);
    }
    else{
        return this.populate(followList,[
            {
                path:'followee',
                select:'avatar _id username fee'
            }
        ]);
    }
}

FollowSchema.statics.getFollowings = async function (followerId,start = 0, perPage = 0) {
    let follows =  this.find(
        {
            $and: [{
                follower: followerId,
                status: true
            },
            {
                $or: [{
                    'followEnd': null
                }, {
                    $and: [{ 'followEnd': { $gte: new Date().toISOString()} }]
                }]
            }]

        }
    )
        .populate('followee','avatar username _id fee')
        .populate('follower','avatar username _id fee')
        .select({
            followee: 1,
            followedAt: 1,
            status: 1,
            followFee: 1,
            followEnd: 1
        });
    if (perPage > 0) {
        follows = follows.skip(start).limit(count);
    }
    return follows;
};


// FollowSchema.statics.getFollowings = async function (followerId) {
//     return this.find(
//         {
//             $and: [{
//                 follower: followerId,
//                 status: true
//             },
//                 {
//                     $or: [{
//                         'followEnd': null
//                     }, {
//                         $and: [{ 'followEnd': { $gte: new Date().toISOString()} }, { 'followEnd': { $ne: null } }]
//                     }]
//                 }]
//
//         }
//     )
//         .populate('followee','avatar username _id')
//         .populate('follower','avatar username _id')
//         .select({
//             followee: 1,
//             followedAt: 1,
//             status: 1,
//             followFee: 1
//         })
//         .lean()
//         .exec();
// };

FollowSchema.statics.getUnfollowers = function () {
    let currentDate = new Date().toISOString();
    return this.find(
        {
            $and: [{
                status: true,
                followEnd: { $lt: currentDate},
            }]
        }
    )
        .populate('followee','avatar username _id o_auth followFee')
        .populate('follower','avatar username _id o_auth')
        .select({
            followee: 1,
            follower: 1,
            followedAt: 1,
            status: 1,
            followFee: 1,
            followEnd: 1
        })
        .lean()
        .exec();
};

FollowSchema.statics.getFollowerCount = async function (followeeId) {
    return this.countDocuments({
        $and: [
            {
                followee: followeeId,
                status: true
            },
            {
                $or: [{
                    'followEnd': null
                }, {
                    $and: [{ 'followEnd': { $gte: new Date().toISOString()} }]
                }]
            }
        ]
    }).exec();
};

FollowSchema.statics.getFollowingCount = async function (followerId) {
    return this.countDocuments({
        $and: [{
            follower: followerId,
            status: true
        },
        {
            $or: [{
                'followEnd': null
            }, {
                $and: [{ 'followEnd': { $gte: new Date().toISOString()} }]
            }]
        }]
    }).exec();
};

FollowSchema.plugin(uniqueValidator);
FollowSchema.plugin(timestamps);
module.exports = mongoose.model('Follow', FollowSchema);
