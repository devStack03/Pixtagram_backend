var express = require("express");
var utils = require('./../../helpers/utils');
var User = require('./../../models/user');
var Comment = require('./../../models/comment');

var auth = require('./../../middlewares/auth')();
const router = express.Router();

router.get('/load/:loaded/:postId', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const loaded = parseInt(req.params.loaded, 10);
    const postId = req.params.postId;
    Comment.findByPost(postId, userId).then(async (comments) => {
        var result = [];
        for (var i = loaded ; i < comments.length && i < loaded+20  ; i++) {
            const user = await User.findUserById(comments[i].commenter._id.toString());
            comments[i].commenter = {username : user.username, _id:user._id,avatar:user.avatar};
            if (comments[i].likes_u) {
                comments[i].myLiked = true;
            } else {
                comments[i].myLiked = false;
            }
            result.push(comments[i]);
        }
        res.json(utils.getResponseResult({comments:result, total: comments.length}, 1, ''));
    });

});


router.post('/', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    Comment.createNewComment(userId, req.body).then(async (post) => {
        let commentCount = await Comment.countByPost(req.body.post);
        if (post) {
            res.json(utils.getResponseResult({count: commentCount, comment: post}, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult(error, 0, 'Database error'));
    });
});

router.get('/:id', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
});

module.exports = router;
