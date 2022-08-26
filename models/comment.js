const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
var findHashtags = require('find-hashtags');
const NotificationSchema = mongoose.model('Notification');
const Schema = mongoose.Schema;

const CommentSchema = new Schema({
    commenter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    text: { type: String, default: '' },
    hashTags: { type: [String], default: [], set: getHashTags },
});

function getHashTags(v) {
    return findHashtags(v);
}

CommentSchema.statics.createNewComment =async function (userId, params) {
    let data = params;
    data['commenter'] = userId;
    data['hashTags'] = params['text'];
    const comment = new this(data);

    const con = await comment.save();
    if(!con){
        return null;
    }
    else{
        const note =await NotificationSchema.createNewNotification(params['owner'],3 ,params['post'],userId);
        return con;
    }
};

CommentSchema.statics.deleteComment = function (req, params) {
    const postId = params.post_id;
    const userId = req.headers['user-id'];

    return this.findOne({
        post: postId,
        commenter: userId
    })
        .remove()
        .exec();
}

CommentSchema.statics.findByUser = function (userId) {
    return this.find({
        commenter: userId
    })
        .populate('commenter')
        .lean()
        .exec();
}

CommentSchema.statics.findByPost =async function (postId, userId = '') {
    // return this.find({
    //     post: postId
    // }).sort({ "_id": -1 })
    //     .populate('commenter')
    //     .lean()
    //     .exec();

    let comm = await this.aggregate([
        {
            "$match": {
                post: postId,
            }
        },
        {
            '$lookup': {
                'from': 'likes', // this should be your collection name for candidates.
                'let':{'id_field': {$toObjectId: "$_id"}, 'islike' : '$isLike'},
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and : [
                                    { $eq:["$comment", "$$id_field"] },
                                    { $eq:["$liker",mongoose.Types.ObjectId(userId)] },
                                ]
                            }
                        }
                    }],
                'as': 'likes_u'
            }
        },
        {
            $unwind: {
                path: '$likes_u',
                preserveNullAndEmptyArrays: true
            }
        },
        { "$sort": { "_id": -1} },
    ]);
    return this.populate(comm,[
        {
            path: 'commenter',
            select: '_id avatar username'
        },
    ]);
}

CommentSchema.statics.countByUser = function (userId) {
    return this.count({
        commenter: userId
    })
        .exec();
}

CommentSchema.statics.countByPost = function (postId) {
    const aggregatorOpts = [
        { $match: { post: postId } },
        {
            $group: {
                _id: "$commenter",
            }
        }
    ]
    return this.aggregate(aggregatorOpts).exec();
}

CommentSchema.index({ hashTags: 1 });
CommentSchema.plugin(uniqueValidator);
CommentSchema.plugin(timestamps);
module.exports = mongoose.model('Comment', CommentSchema);
