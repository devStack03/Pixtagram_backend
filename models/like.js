const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
const PostSchema = mongoose.model('Post');
const NotificationSchema = mongoose.model('Notification');
const Schema = mongoose.Schema;


const LikeSchema = new Schema({
    liker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', default: null},
    comment: {type: Schema.Types.ObjectId, ref: 'Comment', default: null},
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isLike: { type: Boolean, default: true },
});

LikeSchema.post('save', function(doc) {
    if (!doc.comment) {
        PostSchema.increaseLikeCount(doc.post);
    }
});

LikeSchema.post('remove', function (doc) {
    if (!doc.comment) {
        PostSchema.decreaseLikeCount(doc.post);
    }
});


LikeSchema.statics.like = async function (userId, params, owner) {

    try {
        var post = params['post'] ? params['post'] : null;
        var comment = params['comment'] ? params['comment'] : null;
        var isLike = params['isLike'] ? params['isLike'] : true;
        var ctype = params['ctype'] ? params['ctype'] : null;
        var likedBefore = await this.countDocuments({liker: userId, post: post, comment: comment});
    if (!likedBefore) {
        let data = {liker: userId, post: post, comment: comment, owner: owner, isLike: isLike};
        const like = new this(data);
        if (like) {
            if (ctype == 'comment'){
                NotificationSchema.createNewNotification(params['commenter'] ,4 , post,userId);
            }
            else {
                NotificationSchema.createNewNotification(owner ,1 , post,userId);
            }
        }
        return like.save();
    } else {
        try {
            NotificationSchema.deleteNotification(owner ,1 , post);
            var doc = await this.findOne({liker: userId, post: post, comment: comment});

            return doc.remove();
        } catch (error) {
            return new Promise(null, error);
        }
    }
    } catch (error) {
        return new Promise(null, error);
    }
    
};

LikeSchema.statics.unlike = function (req, params) {
    var post = params['post'] ? params['post'] : null;
    var comment = params['comment'] ? params['comment'] : null;
    const userId = req.headers['user-id'];

    return this.findOne({liker: userId, post: post, comment: comment})
        .remove()
        .exec();
}

LikeSchema.statics.findByUser = function (userId) {

    /*
    var sortbyObj = {createdAt: -1, _id: -1 };
    switch (sortby) {
        case 'ma':
            sortbyObj = {'post.likeCount': -1, 'post.bookmarkCount': -1, 'post._id': -1 };
            break;
        case 'np':
            sortbyObj = {'post.createdAt': -1, 'post._id': -1 };
            break;
    }
    return this.aggregate([
        {
            $lookup: {
                from        : 'Post',
                localField  : 'post',
                foreignField: '_id',
                as          : 'post',
            }
        },
        {
            $unwind: {
                path: "$Post"
            }
        },
        {
            $sort: sortbyObj
        }
    ])
    */

    return this.find({
        liker: userId
    })
        .populate('liker')
        .populate('owner','_id username avatar o_auth')
        .populate('post')
        .sort({ post: -1 })
        .lean()
        .exec();
}

LikeSchema.statics.findByPost = function (postId) {
    return this.find({
        post: postId
    })
        .lean()
        .exec();
}

LikeSchema.statics.findByComment = function (commentId) {
    return this.find({
        comment: commentId
    })
        .lean()
        .exec();
}

LikeSchema.statics.countByUser = function (userId) {
    return this.count({
        liker: userId
    })
        .exec();
}

LikeSchema.statics.countByPost = function (postId) {
    return this.count({
        post: postId
    })
        .lean()
        .exec();
}

LikeSchema.statics.findByUserAndPost = function (userId, postId) {
    return this.findOne({
        liker:userId,
        post: postId,
        comment: null
    }).exec();
}

LikeSchema.statics.findByUserAndComment = function (userId="", commentId="") {
    return this.findOne({
        liker:userId,
        comment: commentId
    }).exec();
}

LikeSchema.plugin(uniqueValidator);
LikeSchema.plugin(timestamps);
module.exports = mongoose.model('Like', LikeSchema);
