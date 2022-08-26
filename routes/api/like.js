var express = require("express");
var utils = require('./../../helpers/utils');
var Like = require('./../../models/like');
var Comment = require('./../../models/comment');
var Post = require('./../../models/post');

var auth = require('./../../middlewares/auth')();
const router = express.Router();

router.get('/', auth.authenticate(), (req, res, next) => {
    console.log("comment");

});

router.post('/', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const postId = req.body.post;
    Post.findByPost(postId, userId).then((post) => {
        if (!post || post.length == 0) {
            return res.status(500).json(utils.getResponseResult({}, 0, 'Invalid request.'));
        }
        post = post[0];
        Like.like(userId, req.body, post['owner']).then((like) => {
            if (like) {
                res.json(utils.getResponseResult(like, 1, ''));
            } else {
                res.json(utils.getResponseResult({}, 1, ''));
            }
        }, (error) => {
            return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
        })
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.delete('/:id', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    Like.unlike(req, req.body).then((data) => {
        if (like) {
            res.json(utils.getResponseResult(like, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.post('/getByUser', auth.authenticate(), (req, res, next) => {
    const current_userId = req.headers['user-id'];
    const userId = req.body.userId;
    var sortby = req.body.sortby;
    var result = [];

    if (userId) {
        Post.findByLikes(userId,current_userId).then(async (likes) => {
            if (likes && likes.length > 0) {

                switch (sortby) {
                    case 'np':
                        likes.sort(function (a, b) {
                            if (a.createdAt < b.createdAt)
                                return 1;
                            if (a.createdAt > b.createdAt)
                                return -1;
                            // a must be equal to b
                            return 0;
                        });
                        break;
                    case 'ma':
                        likes.sort(function (a, b) {
                            if (a.likeCount < b.likeCount)
                                return 1;
                            if (a.likeCount > b.likeCount)
                                return -1;
                            // a must be equal to b
                            return 0;
                        });
                        break;
                }

                for (var i = 0; i < likes.length; i++) {
                    let like = likes[i];
                    if (like.isDeleted) {
                        continue;
                    }
                    if(!like.follows_u && like.feedon && like.feedon == '2' && like.owner._id.toString() != current_userId){
                        continue;
                    }
                    try {
                        like.blur = false;
                        if(!like.purchaseds_u && like.fee > 0 && like.owner._id.toString() != current_userId){
                            if(like.owner.followFee && like.owner.followFee > 0) {
                                if(!like.follows_u || !like.follows_u.followEnd || like.follows_u.followEnd == null) {
                                    like.blur = true;
                                }
                                else{
                                    if(like.follows_u.followEnd < new Date().toISOString()) {
                                        like.blur = true;
                                    }
                                }
                            }
                            else{
                                like.blur = true;
                            }
                        }
                        if (like.bookmarks_u) {
                            like.bookmark = true;
                        } else {
                            like.bookmark = false;
                        }
                        if (like.likes_u) {
                            like.myLiked = true;
                        } else {
                            like.myLiked = false;
                        }

                        let comments = await Comment.findByPost(like._id, current_userId);
                        
                        let likeComments = [];
                        for (var j = 0; j < comments.length; j ++) {
                            if (comments[j].likes_u) {
                                comments[j].myLiked = true;
                                likeComments.push(comments[j]);
                            } else {
                                comments[j].myLiked = false;
                            }
                        }

                        like.likeComments = likeComments;
                        like.comments = comments.slice(0, 2);
                        like.commentCount = await Comment.countByPost(like._id.toString());
                        result.push(like);
                    } catch (err) {
                        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
                    }
                }
                return res.json(utils.getResponseResult(result, 1, 'success'));
            } else {
                return res.json(utils.getResponseResult({}, 0, 'User not found'));
            }
        }, (error) => {
            return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
        });
    } else {
        return res.status(404).json(utils.getResponseResult({}, 0, "User id must be attached"));
    }
});

module.exports = router;
