const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
const toJson = require('@meanie/mongoose-to-json');
var findHashtags = require('find-hashtags');
var utils = require('../helpers/utils');
const UserSchema = mongoose.model('User')
const Schema = mongoose.Schema;

const PostSchema = new Schema({

    type: { type: Number, default: 1 }, //  1: status , 2: image , 3: video
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: '', required: true },
    description: { type: String, default: '' },
    location: { type: String, default: 'us' },
    isFlagged: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    hashTags: { type: [String], default: [], set: getHashTags },
    media: { type: String, default: '' },
    thumb: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0},
    myLiked: { type: Boolean, default: false },
    fee: {type: Number, default: 0},
    feedon: {type: String, default: '1'}
}, {
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    });

PostSchema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'post'
});

PostSchema.virtual('id').get(function() {
    return this._id.toHexString();
});

// PostSchema.set('toJSON', {
//     virtuals: true
// });

PostSchema.pre('findOne', autoPopulateComments);
PostSchema.pre('find', autoPopulateComments);


function autoPopulateComments(next) {
    this.populate({
        path: 'comments',
        options: {
            limit: 3,
            sort: { createdAt: -1 },
            populate: {
                path: 'commenter',
                select: 'username'
            }
        }
    });
    next();
}

function getHashTags(v) {
    return findHashtags(v);
}

PostSchema.statics.createNewPost = function (userId, params) {
    let data = params;
    data['owner'] = userId;
    data['hashTags'] = params['description'];
    data['fee'] = params['fee'] > 0 ? params['fee'] : 0;
    const post = new this(data);
    return post.save().then(t => t.populate('owner','_id username avatar').execPopulate());
};

PostSchema.statics.increaseLikeCount = function (postId) {
    return this.findByIdAndUpdate(postId, { $inc: { 'likeCount': 1 } }).exec();
}

PostSchema.statics.decreaseLikeCount = function (postId) {
    return this.findByIdAndUpdate(postId, { $inc: { 'likeCount': -1 } }).exec();
}

PostSchema.statics.increaseBookmarkCount = function (postId) {
    return this.findByIdAndUpdate(postId, { $inc: { 'bookmarkCount': 1 } }).exec();
}

PostSchema.statics.decreaseBookmarkCount = function (postId) {
    return this.findByIdAndUpdate(postId, { $inc: { 'bookmarkCount': -1 } }).exec();
}

PostSchema.statics.getAll =async function (start, count, userId = '') {
    let post =  await this.aggregate([
        {
            "$match": {
                isDeleted: false,
            }
        },
        {
            '$lookup': {
                'from': 'likes', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                    $match: {
                        $expr: {
                            $and : [
                                { $eq:["$post", "$$id_field"] },
                                { $eq:["$liker",mongoose.Types.ObjectId(userId)] },
                                { $eq:["$comment", null] },
                            ]
                        }
                    }
                 }],
                'as': 'likes_u'
            }
        },
        {
            '$lookup': {
                'from': 'bookmarks', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$bookmarkr",mongoose.Types.ObjectId(userId)] },
                                ]
                            }
                        }
                    }],
                'as': 'bookmarks_u'
            }
        },
        {
            '$lookup': {
                'from': 'purchaseds', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$buyer",mongoose.Types.ObjectId(userId)] },
                                ]
                            }
                        }
                    }],
                'as': 'purchaseds_u'
            }
        },

        utils.getFollowObject(userId),

        {
            $unwind: {
                path: '$likes_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$bookmarks_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$follows_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$purchaseds_u',
                preserveNullAndEmptyArrays: true
            }
        },
        { "$sort": { "createdAt": -1} },
        { "$limit": start + count },
        { "$skip": start },
    ]);
    return this.populate(post,[{
        path: 'owner',
        select: '_id avatar username o_auth followFee'
    }]);
}

PostSchema.statics.findByUserAndSort =async function (userId, sortby, start, count,currentUserId=  '') {

    var sortbyObj = {createdAt: -1, _id: -1 };
    switch (sortby) {
        case 'ma':
            sortbyObj = {likeCount: -1, bookmarkCount: -1, _id: -1 };
            break;
        case 'np':
            sortbyObj = {createdAt: -1, _id: -1 };
            break;
    }
    let post = await this.aggregate([
        {
            $match: {
                owner: mongoose.Types.ObjectId(userId),
                isDeleted: false
            }
        },
        {
            '$lookup': {
                'from': 'likes', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$liker", mongoose.Types.ObjectId(currentUserId)] },
                                    { $eq:["$comment", null] },
                                ]
                            }
                        }
                    }],
                'as': 'likes_u'
            }
        },

        {
            '$lookup': {
                'from': 'bookmarks', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$bookmarkr",mongoose.Types.ObjectId(currentUserId)] },
                                ]
                            }
                        }
                    }],
                'as': 'bookmarks_u'
            }
        },
        {
            '$lookup': {
                'from': 'purchaseds', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$buyer",mongoose.Types.ObjectId(currentUserId)] },
                                ]
                            }
                        }
                    }],
                'as': 'purchaseds_u'
            }
        },
        utils.getFollowObject(currentUserId),
        {
            $unwind: {
                path: '$likes_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$bookmarks_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$follows_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$purchaseds_u',
                preserveNullAndEmptyArrays: true
            }
        },
        { "$sort": sortbyObj },
        { "$limit": start + count },
        { "$skip": start },
    ]);
    return this.populate(post, [{
        path: 'owner',
        select: '_id avatar username o_auth followFee'
    }]);
}

PostSchema.statics.findByLikes = async function(userId,currentUserId){
    let post = await this.aggregate([
        {
            '$lookup': {
                'from': 'likes', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$liker",mongoose.Types.ObjectId(userId)] },
                                ]
                            }
                        }
                    }],
                'as': 'posts_u'
            }
        },
        {
            '$lookup': {
                'from': 'bookmarks', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$bookmarkr",mongoose.Types.ObjectId(currentUserId)] },
                                ]
                            }
                        }
                    }],
                'as': 'bookmarks_u'
            }
        },
        {
            '$lookup': {
                'from': 'likes', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$liker", mongoose.Types.ObjectId(currentUserId)] },
                                    { $eq:["$comment", null] },
                                ]
                            }
                        }
                    }],
                'as': 'likes_u'
            }
        },
        {
            '$lookup': {
                'from': 'purchaseds', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$buyer",mongoose.Types.ObjectId(currentUserId)] },
                                ]
                            }
                        }
                    }],
                'as': 'purchaseds_u'
            }
        },
        utils.getFollowObject(currentUserId),
        {
            $unwind: {
                path: '$posts_u',
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $unwind: {
                path: '$follows_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$purchaseds_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$bookmarks_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$likes_u',
                preserveNullAndEmptyArrays: true
            }
        },
        { "$sort": {_id : -1} },
        { "$limit": 20 },
        { "$skip": 0 },
    ]);

    return this.populate(post,[{
        path:'owner',
        select: '_id avatar username fee'
    }]);
}


PostSchema.statics.findByBookmark = async function(userId,currentUserId){
    let post = await this.aggregate([
        {
            '$lookup': {
                'from': 'bookmarks', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$isBookmark", true] },
                                    { $eq:["$bookmarkr",mongoose.Types.ObjectId(userId)] },
                                ]
                            }
                        }
                    }],
                'as': 'posts_u'
            }
        },
        {
            '$lookup': {
                'from': 'bookmarks', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$bookmarkr",mongoose.Types.ObjectId(currentUserId)] },
                                ]
                            }
                        }
                    }],
                'as': 'bookmarks_u'
            }
        },
        {
            '$lookup': {
                'from': 'likes', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$liker", mongoose.Types.ObjectId(currentUserId)] },
                                    { $eq:["$comment", null] },
                                ]
                            }
                        }
                    }],
                'as': 'likes_u'
            }
        },
        {
            '$lookup': {
                'from': 'purchaseds', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$buyer",mongoose.Types.ObjectId(currentUserId)] },
                                ]
                            }
                        }
                    }],
                'as': 'purchaseds_u'
            }
        },
        utils.getFollowObject(currentUserId),
        {
            $unwind: {
                path: '$posts_u',
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $unwind: {
                path: '$follows_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$purchaseds_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$bookmarks_u',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$likes_u',
                preserveNullAndEmptyArrays: true
            }
        },
        { "$sort": {_id : -1} },
        { "$limit": 20 },
        { "$skip": 0 },
    ]);

    return this.populate(post,[{
        path:'owner',
        select: '_id avatar username fee'
    }]);
}

PostSchema.statics.findByPost =async function (postId, userId) {
    // return this.findById(postId)
    //     .populate('owner')
    //     .lean()
    //     .exec();

    let post = await this.aggregate([
        {
            $match: {
                _id: mongoose.Types.ObjectId(postId),
            }
        },
        {
            '$lookup': {
                'from': 'likes', // this should be your collection name for candidates.
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", mongoose.Types.ObjectId(postId)] },
                                    { $eq:["$liker", mongoose.Types.ObjectId(userId)] },
                                    { $eq:["$comment", null] },
                                ]
                            }
                        }
                    }],
                'as': 'likes_u'
            }
        },
        {
            '$lookup': {
                'from': 'bookmarks', // this should be your collection name for candidates.
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", mongoose.Types.ObjectId(postId)] },
                                    { $eq:["$bookmarkr",mongoose.Types.ObjectId(userId)] },
                                ]
                            }
                        }
                    }],
                'as': 'bookmarks_u'
            }
        },
        {
            '$lookup': {
                'from': 'purchaseds', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$post", "$$id_field"] },
                                    { $eq:["$buyer",mongoose.Types.ObjectId(userId)] },
                                ]
                            }
                        }
                    }],
                'as': 'purchaseds_u'
            }
        },

        utils.getFollowObject(userId),
        // {
        //     $unwind: {
        //         path: '$likes_u',
        //         preserveNullAndEmptyArrays: true
        //     }
        // },
        // {
        //     $unwind: {
        //         path: '$bookmarks_u',
        //         preserveNullAndEmptyArrays: true
        //     }
        // },
        // {
        //     $unwind: {
        //         path: '$follows_u',
        //         preserveNullAndEmptyArrays: true
        //     }
        // },
        // {
        //     $unwind: {
        //         path: '$purchaseds_u',
        //         preserveNullAndEmptyArrays: true
        //     }
        // },
    ]);

    return this.populate(post,[{
        path: 'owner',
        select: '_id avatar username'
    }])
}

PostSchema.statics.increaseViews = function (postId) {
    return this.findOneAndUpdate(
        { _id: postId },
        { $inc: { 'views': 1 } }
    )
        .exec();
}

PostSchema.statics.populateByLikeCount = function (search) {
    if ( search == "" ) {
        return this.find({ $or: [{ 'type': 2 }, { 'type': 3 }]
            }).populate('owner')
            .sort({ likeCount: -1, _id: -1 })
            .lean()
            .exec();
    } 
    return this.find(
        { $and:
            [{ $or: [{ 'type': 2 }, { 'type': 3 }] },
            {"hashTags": { $regex : search  }}]
        }).populate('owner')
        .sort({ likeCount: -1, _id: -1 })
        .lean()
        .exec();
}

PostSchema.statics.getPostsCount = async function (userId) {
    return this.countDocuments({
        owner: userId,
        isDeleted: false
    }).exec();
};

PostSchema.statics.delete = function (postId) {
    return this.findOneAndUpdate(
        { _id: postId },
        { $set: { isDeleted: true } }
    )
        .exec();
}

PostSchema.index({ hashTags: 1 });
PostSchema.plugin(toJson);
PostSchema.plugin(uniqueValidator);
PostSchema.plugin(timestamps);
module.exports = mongoose.model('Post', PostSchema);
