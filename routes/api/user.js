const nn_lib = require('./../../shared/constant');
var express = require("express");
var fileUpload = require('express-fileupload');
var utils = require('../../helpers/utils');
var bcrypt = require('../../helpers/bcrypt');
var Follow = require('../../models/follow');
var Post = require('../../models/post');
var User = require('../../models/user');
var Purchased = require('../../models/purchased');
var Transaction = require('../../models/transaction');
var Room = require('../../models/room');
var auth = require('../../middlewares/auth')();
const axios = require("axios");
const router = express.Router();
const aws = require('../../helpers/aws');
var mail = require('../../helpers/aws');
router.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
}));

/**
 * Get User Profile
 */

router.post('/updateFollowUsers', (req,res,next) => {
    const follower = req.body.follower;
    const followee = req.body.followee;
    const fee = req.body.fee;
    const response = Follow.follow(followee,follower,fee,true);
    return res.json(utils.getResponseResult({}, 1, 'success'));
});

router.get('/setFollowUsers', async(req,res,next) => {
    try{
        let followers =await Follow.getUnfollowers();
        if(followers){
            return res.json(utils.getResponseResult(followers, 1, 'success'));
        }
        return res.json(utils.getResponseResult({}, 0, ''));
    }catch(err){
        return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
    }
});

router.get('/profile/:id', auth.authenticate(), async (req, res, next) => {
    const userId = req.params.id;
    if (userId) {
        try {
            let user = await User.findUserById(userId);
            if (user) {
                const posts = await Post.getPostsCount(user._id);
                const followers = await Follow.getFollowerCount(user._id);
                const followings = await Follow.getFollowingCount(user._id);
                let userData = utils.customizedUserInfo(user);
                userData['followers_count'] = followers;
                userData['followings_count'] = followings;
                userData['posts_count'] = posts;

                return res.json(utils.getResponseResult(userData, 1, 'success'));
            } else {
                return res.json(utils.getResponseResult({}, 0, 'User not found'));
            }
        } catch (error) {
            return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
        }
    } else {
        return res.status(404).json(utils.getResponseResult({}, 0, "User id must be attached"));
    }
});

router.get('/username/:username', auth.authenticate(), async (req, res, next) => {
    const username = req.params.username;
    if (username) {
        try {
            let user = await User.findUser(username);
            if (user) {
                const posts = await Post.getPostsCount(user._id);
                const followers = await Follow.getFollowerCount(user._id);
                const followings = await Follow.getFollowingCount(user._id);
                let userData = utils.customizedUserInfo(user);
                userData['followers_count'] = followers;
                userData['followings_count'] = followings;
                userData['posts_count'] = posts;

                return res.json(utils.getResponseResult(userData, 1, 'success'));
            } else {
                return res.json(utils.getResponseResult({}, 0, 'User not found'));
            }
        } catch (error) {
            return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
        }
    } else {
        return res.status(404).json(utils.getResponseResult({}, 0, "User id must be attached"));
    }
});

router.get('/followers', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];

    if (userId) {
        Follow.getFollowers(userId).then((followers) => {
            if (followers && followers.length > 0) {
                return res.json(utils.getResponseResult(followers, 1, 'success'));
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

router.get('/followings', auth.authenticate(),async (req, res, next) => {
    const userId = req.headers['user-id'];
    if (userId) {
        let purchasers = await Purchased.getPurchased(userId);
        Follow.getFollowings(userId).then((followings) => {
            if (followings && followings.length > 0) {
                return res.json(utils.getResponseResult({follows: followings, purchase: purchasers}, 1, 'success'));
            } else {
                return res.json(utils.getResponseResult({follows: [], purchase: purchasers}, 1, 'success'));
            }
        }, (error) => {
            return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
        });
    } else {
        return res.status(404).json(utils.getResponseResult({}, 0, "User id must be attached"));
    }
});

/**
 * get 
 */

router.get('/popular/:loaded', auth.authenticate(),  (req, res, next) => {
    const loaded = parseInt(req.params.loaded, 10);
    const userId = req.headers['user-id'];
    User.populateByFollowers(userId).then( async (users) => {
        var result = [];
        for (var i = loaded ; i < users.length && i < loaded+12  ; i++) {
            const follow = await Follow.checkFollow(users[i]._id.toString(), userId);
            var u = users[i];
            if (follow && !follow.unfollowedAt){
                u.isFollowing = true;
            }
            else {
                u.isFollowing = false;
            }
            result.push(u);
        }
        res.json(utils.getResponseResult({user:result, total: users.length}, 1, ''));
    });
});

router.patch('/:id', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    if (userId) {
        User.updateUserById(userId, req.body).then((user) => {
            if (user) {
                return res.json(utils.getResponseResult(utils.customizedUserInfo(user), 1, 'success'));
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

/**
 * Remove current Photo
 */
router.delete('/:id/remove-avatar', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    if (userId) {
        User.removeCurrentAvatar(userId).then((_user) => {
            if (_user)
                res.json(utils.getResponseResult({}, 1, "Success"));
        }, (error) => {
            return res.status(400).json(utils.getResponseResult({}, 0, "Database failure."));
        });
    }
});
/**
 * Update avatar
 */
router.patch('/:id/update-avatar', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const picUrl = req.body.pic_url;
    if (userId) {
        User.updateCurrentAvatar(userId, picUrl).then((_user) => {
            if (_user)
                res.json(utils.getResponseResult({}, 1, "Success"));
        }, (error) => {
            return res.status(400).json(utils.getResponseResult({}, 0, "Database failure."));
        });
    }
});

/**
 * Change Password
 */

router.post('/followings', auth.authenticate(), (req, res , next) => {

    const userId = req.headers['user-id'];
    const perPage = req.body.perPage;
    const start = req.body.start;
    const followType = req.body.followType;
    const username = req.body.username;
    if(!userId){
        return res.status(404).json(utils.getResponseResult({}, 0, "User id must be attached"));
    }
    Follow.getFollowList(userId,start,perPage,followType,username).then((followers) => {
        if (followers && followers.length > 0) {
            return res.json(utils.getResponseResult(followers, 1, 'success'));
        } else {
            return res.json(utils.getResponseResult({}, 0, 'Followers not found'));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
    });
});

router.post('/change-password', auth.authenticate(), (req, res, next) => {

    const userId = req.body.id;
    const old_password = req.body.oldPassword;
    const new_password = req.body.newPassword;

    User.findById(userId, (err, user) => {

        if (err) return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));

        if (!user) return res.status(404).json(utils.getResponseResult({}, 0, "User not found"));


        bcrypt.compareHash(user.password, old_password).then(result => {
            if (result) {
                //generate password compareHash
                bcrypt.generateHash(new_password).then(hash => {
                    //Create a new account 
                    console.log("hash is **", hash);
                    user.password = hash;
                    user.save().then(doc => {
                        console.log("account is ***", doc);
                        res.json(utils.getResponseResult({}, 1, "Success"));
                    });
                });
            } else {
                return res.status(403).json(utils.getResponseResult({}, 0, "You entered the wrong password."));
            }
        }).catch(error => {
            return res.status(500).json(utils.getResponseResult({}, 0, "Unknown issue"));
        });
    })
});

/**
 * Change email address
 */

router.post('/changeEmail', auth.authenticate(), (req, res, next) => {
    const user_id = req.body.userId;
    const new_email = req.body.new_email;
    Account.findById(user_id, (err, account) => {
        if (err) return res.status(500).json(ResponseResult.getResponseResult({}, 0, "database failure"));

        if (!account) return res.status(404).json(ResponseResult.getResponseResult({}, 0, "User not found"));

        var code = random(5, "123456789");

        aws.sendVerificationEmail(new_email, account.username, code, function (err, data) {
            if (data) {
                console.log("data => error => ", data, err);
                account.common_profile.email = new_email;
                // account.is_verified = 0;
                account.verify = code;

                account.save().then(doc => {
                    console.log("account is ***", doc);
                    res.json(ResponseResult.getResponseResult({
                        _id: doc._id.toString(),
                        type: doc.type,
                        verified: doc.is_verified,
                        common_profile: doc.common_profile,
                        user_setting: doc.user_setting,
                        username: doc.username,
                        o_auth: doc.o_auth
                    }, 1, "Success."));
                });
            } else {
                return res.status(404).json(ResponseResult.getResponseResult({}, 0, "Can not send a code."));
            }
        });
    });
})

/**
 * Change private option
 */

router.post('/changeMessageOption', auth.authenticate(), (req, res, next) => {
    const user_id = req.body.userId;
    const setting = req.body.chat_setting;
    Account.findById(user_id, (err, account) => {

        if (err) return res.status(500).json(ResponseResult.getResponseResult({}, 0, "database failure"));

        if (!account) return res.status(404).json(ResponseResult.getResponseResult({}, 0, "User not found"));

        account.user_setting.message_send_mode = setting;
        account.save().then(doc => {
            console.log("account is ***", doc);
            res.json(ResponseResult.getResponseResult({
                _id: doc._id.toString(),
                type: doc.type,
                verified: doc.is_verified,
                common_profile: doc.common_profile,
                user_setting: doc.user_setting,
                username: doc.username,
                o_auth: doc.o_auth
            }, 1, "success"));
        })

    });
});

router.post('/updateChat', async (req, res, next) => {
    try{
        const userId = req.headers['user-id'];
        const oid = req.body.uid;
        let room  = await Room.oneRoom(userId,oid);
        if (!room) {
            room = await Room.createRoom(userId, [oid], '', 2);
        }
        if (room) {
            return res.status(200).json(utils.getResponseResult(room, 1, ''));
        }
        else{
            return res.status(200).json(utils.getResponseResult({}, 0, ''));
        }
    }catch(e){
        return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
    }
});

router.post('/getBySearchWithUsername', (req, res, next) => {
    const userId = req.headers['user-id'];
    var search = req.body.search ;
    var excepting_users = req.body.excepting;
    if (search) {
        // console.log('search');
    } else {
        search = '';
    }
    var start = req.body.start;
    var count = req.body.count;
    excepting_users.push(userId);
    User.getBySearchWithUsername(search, start, count, excepting_users).then(async (users) => {
        res.json(utils.getResponseResult({user:users, total: users.length}, 1, ''));
    });
});

router.post('/transferBalance' ,auth.authenticate(),async (req, res, next) => {
    const userId = req.headers['user-id'];
    var owner = req.body.owner;
    var postId = req.body.postId;
    var postFee = req.body.postFee;
    var credit_id = '';
    var credit_key = '';
    var id = '';
    var credit_id1 = '';
    var credit_key1 = '';
    var email = "";
    var comment = "";
    const postDetail=  await Post.findById(postId);
    if(userId && owner && postId && postFee > 0 && postDetail){
        const existed_follow = await Follow.getFollowOne(owner,userId);
        if(existed_follow){
            return res.status(200).json(utils.getResponseResult({code: 2,follower: existed_follow}, 0, "You've already followed this post"));
        }
        const purchasers = await  Purchased.getPurchased(userId,postId);
        if(purchasers && purchasers.length > 0){
            return res.status(200).json(utils.getResponseResult({code: 1}, 0, "You've already purchased this post"));
        }

        const user =await User.getUsersByMultiple([userId,owner]);
        if (!user || user.length < 2) return res.status(404).json(utils.getResponseResult({}, 0, "User not found"));
        for(const u of user){
            if(u._id == userId){
                credit_id = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.credit_id ? u.o_auth.nn_network.credit_id : '':'':'';
                credit_key = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.credit_key ? u.o_auth.nn_network.credit_key : '':'':'';
                id = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.id ? u.o_auth.nn_network.id : '':'':'';
            }
            if(u._id == owner){
                email = u.email;
                credit_id1 = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.credit_id ? u.o_auth.nn_network.credit_id : '':'':'';
                credit_key1 = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.credit_key ? u.o_auth.nn_network.credit_key : '':'':'';
            }
        }

        if (!credit_id && !credit_key && !id) {
            return res.status(200).json(utils.getResponseResult({}, 0, "You're not a NN member"));
        }
        else if(!credit_id1){
            return res.status(200).json(utils.getResponseResult({}, 0, "The user that you send is not a NN member"));
        }
        else{
            let current_timestamp = parseInt(Date.now() / 1000);
            const hashHma1 = utils.getHashHma(nn_lib.clientId,current_timestamp);
            const hashHma2 = utils.getHashHma(credit_key,current_timestamp);
            if(postDetail.type == 2){
                comment= "Received for viewing of image " + postDetail.media;
            }
            else{
                comment= "Received for viewing of video " + postDetail.media;
            }
            try{
                const r = await axios.post(nn_lib.nnbalance + credit_id + '/send',{
                    ToAccountId: credit_id1,
                    Amount: postFee,
                    Comment: comment
                },{
                    headers:{
                        'X-ApiKey': nn_lib.x_api,
                        'X-ApiKeyValidation': current_timestamp + '|' + hashHma1,
                        'X-Validation': current_timestamp + '|' + hashHma2
                    }
                });
                if(r.status == 200 && r.data && r.data.Data.FromBalance){
                    const purchaseNew = await Purchased.insertPurchase(userId,postId,postFee);
                    if(purchaseNew){
                        const transaction = await Transaction.insertTransaction({
                            from:userId,
                            to:owner,
                            post:postId,
                            fee:postFee,
                            type:'post'
                        });
                        let buyer = '';
                        if(purchaseNew && purchaseNew.buyer && purchaseNew.buyer.username) {
                            buyer = purchaseNew.buyer.username;
                        }
                        let message = "<div style='text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:20px;color:#5f5f5f;line-height:135%;margin-top:0;margin-bottom:20px'>";
                        message += '<a href="https://' + req.get('host') + '/users/'+userId + '" target="_blank">'+buyer+'</a>';
                        message += ' viewed ' + '<a href="https://'+req.get('host') + '/view-post/' + postId + '" target="_blank">your post</a>';
                        message += ' for ' + postFee + ' nudles.';
                        if(purchaseNew.post.media && purchaseNew.post.type == 2){
                            message += "<div><img src='"+purchaseNew.post.media+"' style='max-width:620px;width:100%;margin-top:20px;margin-bottom:20px;display:block'/></div>";
                        }
                        message +="</div>";
                        mail.sendGridSendMail(purchaseNew.post.owner.email,'Post View',message,function(err,data){

                        });
                        return res.status(200).json(utils.getResponseResult({purchaser: purchaseNew, balance: r.data.Data.FromBalance}, 1, ''));
                    }
                    else{
                        return res.status(200).json(utils.getResponseResult({code: 2}, 0, 'Database Failure'));
                    }
                }
                else{
                    return res.status(200).json(utils.getResponseResult({code: 2}, 0, 'Database Failure'));
                }
            }catch(e){
                return res.status(200).json(utils.getResponseResult({code: 3}, 0, "Transferring Error"));
            }
        }
    }
    return res.status(200).json(utils.getResponseResult({code: 3}, 0, "Error"));
});

router.post('/getBalanceFromNN', async (req, res, next) => {
    const userId = req.headers['user-id'];

     User.findById(userId).then(async (user) => {
        if (!user) return res.status(404).json(utils.getResponseResult({}, 0, "User not found"));
        const credit_id = user.o_auth ? user.o_auth.nn_network ? user.o_auth.nn_network.credit_id ? user.o_auth.nn_network.credit_id : '':'':'';
        const credit_key = user.o_auth ? user.o_auth.nn_network ? user.o_auth.nn_network.credit_key ? user.o_auth.nn_network.credit_key : '':'':'';
        const id = user.o_auth ? user.o_auth.nn_network ? user.o_auth.nn_network.id ? user.o_auth.nn_network.id : '':'':'';
        if(!credit_id && !credit_key && !id){
            if (!user) return res.status(404).json(utils.getResponseResult({}, 0, "You're not a NN member"));
        }
        let current_timestamp = parseInt(Date.now() / 1000);
        const hashHma1 = utils.getHashHma(nn_lib.clientId,current_timestamp);
        const hashHma2 = utils.getHashHma(credit_key,current_timestamp);
        try{
            const r = await axios.get(nn_lib.nnbalance + credit_id + '/balance', {
                headers: {
                    'X-ApiKey': nn_lib.x_api,
                    'X-ApiKeyValidation': current_timestamp + '|' + hashHma1,
                    'X-Validation': current_timestamp + '|' + hashHma2
                }
            });
            if(r.status == 200 && r.data && r.data.Data && r.data.Data.Balance != undefined){
                return res.json(utils.getResponseResult({balance: r.data.Data.Balance}, 1, ''));
            }
            else if(r.Message && r.status !=200){
                return res.status(r.status).json(utils.getResponseResult({}, 0, r.Message));
            }
            else{
                return res.status(500).json(utils.getResponseResult({}, 0, "Process Error"));
            }
        }catch(err){
            return res.status(500).json(utils.getResponseResult({}, 0, "Process Error"));
        }
    }, (err) => {
         return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
    });
});

router.post('/getTransaction', async(req, res, next) => {
    const userId = req.headers['user-id'];
    const from = req.body.from;
    const to = req.body.to;
    const type = req.body.type;
    const transList = await Transaction.getTrans(from,to,userId, type);
    if(transList){
        return res.json(utils.getResponseResult(transList, 1, ''));
    }
    else{
        return res.status(200).json(utils.getResponseResult({}, 0, "Processing Error"));
    }
});

router.post('/deleteTransaction', async (req, res, next) => {
   const userId = req.headers['user-id'];
   const ids = req.body.ids;
   const type = req.body.type;
   const transList = await Transaction.deleteTrans(userId, ids, type);
    if(transList){
        return res.json(utils.getResponseResult({}, 1, ''));
    }
    else{
        return res.status(200).json(utils.getResponseResult({}, 0, "Processing Error"));
    }
});

module.exports = router;
