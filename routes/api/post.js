var express = require("express");
var mongoose = require('mongoose');
var utils = require('./../../helpers/utils');
var User = require('./../../models/user');
var Notification = require('./../../models/notification');
var Comment = require('./../../models/comment');
var Post = require('./../../models/post');
var Like = require('./../../models/like');
var Bookmark = require('./../../models/bookmark');
var Follow = require('./../../models/follow');
var auth = require('./../../middlewares/auth')();
const router = express.Router();

router.get('/', auth.authenticate(), async (req, res, next) => {
    const userId = req.headers['user-id'];
    try {
        let posts = await Post.getAll();
        posts.sort(function (a, b) {
            if (a.createdAt < b.createdAt)
                return 1;
            if (a.createdAt > b.createdAt)
                return -1;
            // a must be equal to b
            return 0;
        });

        for (var i = 0; i < posts.length; i++) {
            let post = posts[i];
            try {
                let like = await Like.findByUserAndPost(userId, post._id.toString());
                if (like) {
                    post.myLiked = true;
                } else {
                    post.myLiked = false;
                }

                let bookmark = await Bookmark.findByUserAndPost(userId, post._id.toString());
                if (bookmark) {
                    post.bookmark = true;
                } else {
                    post.bookmark = false;
                }

                let comments = await Comment.findByPost(post._id, userId);
                let likeComments = [];
                for (var j = 0; j < comments.length; j++) {
                    if (comments[j].likes_u) {
                        comments[j].myLiked = true;
                        likeComments.push(comments[j]);
                    } else {
                        comments[j].myLiked = false;
                    }
                }
                // post.comments = [];//comments.slice(0, 20);
                post.comments = comments.slice(0, 2);
                post.likeComments = likeComments;
                post.commentCount = await Comment.countByPost(post._id.toString());
            } catch (err) {
                return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
            }
        }
        res.json(utils.getResponseResult(posts, 1, ''));
    } catch (error) {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    }

});

router.get('/user/:user_id', auth.authenticate(), (req, res, next) => {

});

router.post('/populate', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const loaded = parseInt(req.body.loaded, 10);
    var search = req.body.search;
    if (search) {
        console.log('search');
    } else {
        search = '';
    }
    Post.populateByLikeCount(search).then(async (posts) => {
        var result = [];
        for (var i = loaded; i < posts.length && i < loaded + 12; i++) {
            posts[i].src = posts[i].media;
            posts[i].caption = posts[i].title;
            posts[i].commentCount = await Comment.countByPost(posts[i]._id.toString());
            posts[i].comments = [];
            let like = await Like.findByUserAndPost(userId, posts[i]._id.toString());
            if (like) {
                posts[i].myLiked = true;
            } else {
                posts[i].myLiked = false;
            }

            let bookmark = await Bookmark.findByUserAndPost(userId, posts[i]._id.toString());
            if (bookmark) {
                posts[i].bookmark = true;
            } else {
                posts[i].bookmark = false;
            }
            const follow = await Follow.checkFollow(posts[i].owner._id.toString(), userId);

            if (follow && !follow.unfollowedAt) {
                posts[i].owner.isFollowing = true;
            }
            else {
                posts[i].owner.isFollowing = false;
            }
            result.push(posts[i]);
        }
        res.json(utils.getResponseResult({ post: result, total: posts.length }, 1, ''));
    });
});

router.post('/populate_move', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const postId = req.body.postId;
    const direction = parseInt(req.body.direction, 10);
    var search = req.body.search;
    if (search) {
        console.log('search');
    } else {
        search = '';
    }
    Post.populateByLikeCount(search).then(async (posts) => {
        var i = 0;
        var result = { post: {}, index: 0, count: 0 };
        for (i = 0; i < posts.length; i++)
            if (posts[i]._id.toString() == postId)
                break;
        if (i < posts.length && i + direction >= 0 && i + direction < posts.length) {
            result.post = posts[i + direction];
            result.post.commentCount = await Comment.countByPost(result.post._id.toString());
            result.post.comments = [];
            let like = await Like.findByUserAndPost(userId, result.post._id.toString());
            if (like) {
                result.post.myLiked = true;
            } else {
                result.post.myLiked = false;
            }

            let bookmark = await Bookmark.findByUserAndPost(userId, result.post._id.toString());
            if (bookmark) {
                result.post.bookmark = true;
            } else {
                result.post.bookmark = false;
            }

            const follow = await Follow.checkFollow(result.post.owner._id.toString(), userId);

            if (follow && !follow.unfollowedAt) {
                result.post.owner.isFollowing = true;
            }
            else {
                result.post.owner.isFollowing = false;
            }
            result.index = i + direction;
            result.count = posts.length;
        }
        res.json(utils.getResponseResult(result, 1, ''));
    });
});

router.get('/:post_id', (req, res, next) => {
    let userId = req.headers['user-id'];
    if (!userId) {
        userId = '';
    }
    Post.findByPost(req.params.post_id, userId).then(async (post) => {
            if (post && post.length > 0) {
                post= post[0];
                try
                    {
                        post.myLiked = false;
                        post.bookmark = false;
                        if (userId) {
                            post.blur = false;
                            if((!post.purchaseds_u || post.purchaseds_u.length == 0) && post.fee > 0 && post.owner._id.toString() != userId){
                                if(post.owner.followFee && post.owner.followFee > 0) {
                                    if(!post.follows_u || post.follows_u.length == 0 || !post.follows_u[0].followEnd || post.follows_u[0].followEnd == null) {
                                        post.blur = true;
                                    }
                                    else{
                                        if(post.follows_u[0].followEnd < new Date().toISOString()) {
                                            post.blur = true;
                                        }
                                    }
                                }
                                else{
                                    post.blur = true;
                                }
                            }
                            if (post.likes_u && post.likes_u.length > 0) {
                                post.myLiked = true;
                            }
                            if (post.bookmarks_u && post.bookmarks_u.length > 0) {
                                post.bookmark = true;
                            }
                        }
                        else{
                            post.blur = true;
                        }

                        let comments = await Comment.findByPost(post._id, userId);
                        let likeComments = [];
                        let comments_image = [];
                        for (var j = 0; j < comments.length; j++) {
                            if(userId){
                                if (comments[j].likes_u) {
                                    comments[j].myLiked = true;
                                    likeComments.push(comments[j]);
                                } else {
                                    comments[j].myLiked = false;
                                }
                            }
                            else{
                                comments[j].myLiked = false;
                            }
                            comments_image.push(comments[j].commenter.avatar);
                        }
                        comments_image = comments_image.filter(function(item, pos, self) {
                            return self.indexOf(item) == pos;
                        })
                        post.comment_images = comments_image.slice(0,5);
                        post.comments = comments.slice(0, 2);
                        post.likeComments = likeComments;
                        post.commentCount = await Comment.countByPost(post._id.toString());
                        res.json(utils.getResponseResult(post, 1, ''));

                    } catch (err) {
                        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
                }
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.get('/embeded/:post_id', (req, res, next) => {
    const userId = req.headers['user-id'];
    //const sessionId = req._remoteAddress;

    Post.findByPost(req.params.post_id).then(async (post) => {
        if (post) {
            try {
                let comments = await Comment.findByPost(post._id, userId);
                let likeComments = [];
                for (var j = 0; j < comments.length; j++) {
                    comments[j].myLiked = false;
                    likeComments.push(comments[j]);
                }
                post.comments = comments.slice(0, 2);
                post.likeComments = likeComments;
                post.commentCount = await Comment.countByPost(post._id.toString());

                res.json(utils.getResponseResult(post, 1, ''));

            } catch (err) {
                return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
            }

        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});



router.post('/', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    Post.createNewPost(userId, req.body).then((post) => {
        if (post) {
            res.json(utils.getResponseResult(post, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.post('/bookmark-feed', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    Bookmark.bookmark(userId, req.body).then((bookmark) => {
        if (bookmark) {
            res.json(utils.getResponseResult(bookmark, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.post('/populateByUser',auth.authenticate(), (req, res, next) => {
    const userId = req.body.userId;
    var sortby = req.body.sortby;
    var start = req.body.start;
    var count = req.body.count;
    const current_userid = req.headers['user-id'];
    Post.findByUserAndSort(userId, sortby, start, count,current_userid).then(async (posts) => {
        let post_result = [];
        for (var i = 0; i < posts.length && i < 12; i++) {
            let post = posts[i];
            if(!post.follows_u && post.feedon && post.feedon == '2' && post.owner._id.toString() != current_userid){
                continue;
            }
            try {
                post.blur = false;
                if(!post.purchaseds_u && post.fee > 0 && post.owner._id.toString() != current_userid){
                    if(post.owner.followFee && post.owner.followFee > 0) {
                        if(!post.follows_u || !post.follows_u.followEnd || post.follows_u.followEnd == null) {
                            post.blur = true;
                        }
                        else{
                            if(post.follows_u.followEnd < new Date().toISOString()) {
                                post.blur = true;
                            }
                        }
                    }
                    else{
                        post.blur = true;
                    }
                }
                if (post.likes_u) {
                    post.myLiked = true;
                } else {
                    post.myLiked = false;
                }

                if (post.bookmarks_u) {
                    post.bookmark = true;
                } else {
                    post.bookmark = false;
                }

                let comments = await Comment.findByPost(post._id, current_userid);
                let likeComments = [];
                if(comments.length > 0) {
                    for (var j = 0; j < comments.length; j++) {
                        if (comments[j].likes_u) {
                            comments[j].myLiked = true;
                            likeComments.push(comments[j]);
                        } else {
                            comments[j].myLiked = false;
                        }
                    }
                }
                post.comments = comments.slice(0, 2);
                post.likeComments = likeComments;
                post.commentCount = await Comment.countByPost(post._id.toString());
                post_result.push(post);
            } catch (err) {
                return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
            }

        }
        res.json(utils.getResponseResult({ post: post_result, total: posts.length }, 1, ''));
    });
});

router.post('/getAll', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    var start = req.body.start;
    var count = req.body.count;

    Post.getAll(start, count, userId).then(async (posts) => {
        let post_result = new Array();
        for (var i = 0; i < posts.length && i < 12; i++) {
            let post = posts[i];
            if(!post.follows_u && post.feedon && post.feedon == '2' && post.owner._id.toString() != userId){
                continue;
            }
            try {
                post.blur = false;
                if(!post.purchaseds_u && post.fee > 0 && post.owner._id.toString() != userId){
                    if(post.owner.followFee) {
                        if(!post.follows_u || !post.follows_u.followEnd || post.follows_u.followEnd == null) {
                            post.blur = true;
                        }
                        else{
                            if(post.follows_u.followEnd < new Date().toISOString()) {
                                post.blur = true;
                            }
                        }
                    }
                    else{
                        if(!post.follows_u ||  !post.follows_u.followEnd || post.follows_u.followEnd <= new Date().toISOString()){
                            post.blur = true;
                        }
                    }
                }

                if (post.likes_u) {
                    post.myLiked = true;
                } else {
                    post.myLiked = false;
                }
                post.likes_u = null;
                if (post.bookmarks_u) {
                    post.bookmark = true;
                } else {
                    post.bookmark = false;
                }
                post.bookmarks_u = null;
                let comments = await Comment.findByPost(post._id,userId);
                let likeComments = [];
                let comments_image = [];
                if(comments.length > 0) {
                    for (var j = 0; j < comments.length; j++) {
                        if (comments[j].likes_u) {
                            comments[j].myLiked = true;
                            likeComments.push(comments[j]);
                        } else {
                            comments[j].myLiked = false;
                        }
                        comments_image.push(comments[j].commenter.avatar);
                    }
                }
                comments_image = comments_image.filter(function(item, pos, self) {
                    return self.indexOf(item) == pos;
                })
                post.comment_images = comments_image.slice(0,5);
                post.comments = comments.slice(0, 2);
                post.likeComments = likeComments;
                const tempCount = await Comment.countByPost(post._id);
                post.commentCount = tempCount.length;
                post_result.push(post);
            } catch (err) {
                return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
            }
        }
        res.json(utils.getResponseResult({ post: post_result, total: count + 10 }, 1, ''));
    });
});

router.delete('/:id', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const postId = req.params.id;
    Post.delete(postId).then((data) => {
        if (data) {
            res.json(utils.getResponseResult(data, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

module.exports = router;
