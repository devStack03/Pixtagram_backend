var express = require("express");
var utils = require('../../helpers/utils');
var Post = require('../../models/post');
var Bookmark = require('../../models/bookmark');
var Comment = require('./../../models/comment');
var auth = require('../../middlewares/auth')();
const router = express.Router();

router.get('/', (req, res, next) => {

});

router.post('/', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const postId = req.body.post;

    Post.findByPost(postId, userId).then((post) => {
        if (!post || post.length == 0) {
            return res.status(500).json(utils.getResponseResult({}, 0, 'Invalid request.'));
        }
        post = post[0];
        Bookmark.bookmark(userId, req.body, post['owner']).then((bookmark) => {
            if (bookmark) {
                res.json(utils.getResponseResult(bookmark, 1, ''));
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
    const bookmarkId = req.params.id;
    Bookmark.unbookmark(req, bookmarkId).then((data) => {
        if (data) {
            res.json(utils.getResponseResult(data, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.get('/getByUser/:userId', auth.authenticate(), (req, res, next) => {
    const current_userId = req.headers['user-id'];
    const userId = req.params.userId;
    var result = [];

    if (userId) {
        Post.findByBookmark(userId,current_userId).then( async (bookmarks) => {
            if (bookmarks && bookmarks.length > 0) {
                bookmarks.sort(function (a, b) {
                    if (a.createdAt < b.createdAt)
                        return 1;
                    if (a.createdAt > b.createdAt)
                        return -1;
                    // a must be equal to b
                    return 0;
                });

                for (var i = 0; i < bookmarks.length; i++) {
                    let bookmark = bookmarks[i];
                    if (bookmark.isDeleted) {
                        continue;
                    }
                    if(!bookmark.follows_u && bookmark.feedon && bookmark.feedon == '2' && bookmark.owner._id.toString() != current_userId){
                        continue;
                    }
                    try {
                        bookmark.blur = false;
                        if(!bookmark.purchaseds_u && bookmark.fee > 0 && bookmark.owner._id.toString() != current_userId){
                            if(bookmark.owner.followFee && bookmark.owner.followFee > 0) {
                                if(!bookmark.follows_u || !bookmark.follows_u.followEnd || bookmark.follows_u.followEnd == null) {
                                    bookmark.blur = true;
                                }
                                else{
                                    if(bookmark.follows_u.followEnd < new Date().toISOString()) {
                                        bookmark.blur = true;
                                    }
                                }
                            }
                            else{
                                bookmark.blur = true;
                            }
                        }
                        if (bookmark.likes_u) {
                            bookmark.myLiked = true;
                        } else {
                            bookmark.myLiked = false;
                        }
                        if (bookmark.bookmarks_u) {
                            bookmark.bookmark = true;
                        } else {
                            bookmark.bookmark = false;
                        }

                        let comments = await Comment.findByPost(bookmark._id , current_userId);

                        let likeComments = [];
                        for (var j = 0; j < comments.length; j ++) {
                            if (comments[j].likes_u) {
                                comments[j].myLiked = true;
                                likeComments.push(comments[j]);
                            } else {
                                comments[j].myLiked = false;
                            }
                        }
                        bookmark.likeComments = likeComments;
                        bookmark.comments = comments.slice(0, 2);
                        bookmark.commentCount = await Comment.countByPost(bookmark._id.toString());
                        result.push(bookmark);
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
