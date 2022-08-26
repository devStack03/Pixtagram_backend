var express = require("express");

var utils = require('../../helpers/utils');
var Follow = require('../../models/follow');
var User = require('../../models/user');
var auth = require('../../middlewares/auth')();
const nn_lib = require('./../../shared/constant');
const axios = require("axios");
const router = express.Router();

router.get('/', (req, res, next) => {
    console.log("friends");

});



// router.get('/:query',passport.authenticate('bearer', { session: false }),
//         oauth2Server.error(), 

//search friend
router.post('/searchFriends', auth.authenticate(), async (req, res, next) => {

    let searchQuery = req.body.query;
    let userId = req.body.userId;
    console.log("query == ", searchQuery);

    if (searchQuery.length < 3) {

        res.json([]);
    }

    const accounts = await Account.search(searchQuery);

    if (!accounts) {

        return res
            .status(404)
            .json(ResponseResult.getResponseResult({}, 0, "User not found"));
    } else {

        var result = [];

        for (var i = 0, len = accounts.length; i < len; i++) {
            var account = accounts[i];
            const friend = await Friend.checkFollow({
                followee: account._id,
                follower: mongoose.Types.ObjectId(userId)
            });

            var userData = {
                _id: account._id.toString(),
                username: account.username,
                avatar: account.common_profile.avatar,
                message_mode: account.user_setting.message_send_mode
            };

            if (friend) {
                if (friend.accept) {
                    userData["isFriend"] = true;
                } else {
                    userData["isFriend"] = false;
                    userData["sent"] = true;
                }

            } else {
                userData["isFriend"] = false;
                userData["sent"] = false;
            }
            result.push(userData);

        }
        res.json(ResponseResult.getResponseResult(result, 1, "success"));
    }
})

// get all friends
router.post('/allFriends', auth.authenticate(), (req, res, next) => {

    const userId = req.body.userId;

    Friend.getAllFriends(userId).then(friends => {
        if (friends) {
            console.log("Friends => :", friends);
            res.json(ResponseResult.getResponseResult(friends, 1, "success"));
        } else {
            return res
                .status(404)
                .json(ResponseResult.getResponseResult({}, 0, "Friend not found"));
        }
    });

});

// follow user
router.post('/follow', auth.authenticate(),async (req, res, next) => {
    const userId  = req.headers['user-id'];
    const following = req.body.following;
    const fee = req.body.fee;
    var credit_id = '';
    var credit_key = '';
    var id = '';
    var credit_id1 = '';
    var credit_key1 = '';
    let doc = null;
    let update_val = '';
    let balance = 0;
    try{
        const follow = await Follow.checkFollow(following, userId);
        if (follow != null) {
            return res.json(utils.getResponseResult({isCreated: false}, 1, "Success."));
        }
        const user = await User.findById(following);
        if (!user) return res.status(404).json(utils.getResponseResult({}, 0, "User not found"));
        const current_user = await User.findById(userId);
        if(!current_user){
            return res.status(404).json(utils.getResponseResult({}, 0, "User not found"));
        }
        if(fee > 0){
            credit_id1 = user.o_auth ? user.o_auth.nn_network ? user.o_auth.nn_network.credit_id ? user.o_auth.nn_network.credit_id : '':'':'';
            credit_key1 = user.o_auth ? user.o_auth.nn_network ? user.o_auth.nn_network.credit_key ? user.o_auth.nn_network.credit_key : '':'':'';
            credit_id = current_user.o_auth ? current_user.o_auth.nn_network ? current_user.o_auth.nn_network.credit_id ? current_user.o_auth.nn_network.credit_id : '':'':'';
            credit_key = current_user.o_auth ? current_user.o_auth.nn_network ? current_user.o_auth.nn_network.credit_key ? current_user.o_auth.nn_network.credit_key : '':'':'';
            id = current_user.o_auth ? current_user.o_auth.nn_network ? current_user.o_auth.nn_network.id ? current_user.o_auth.nn_network.id : '':'':'';
        }
        try{
            if(fee > 0){
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
                    try{
                        const r = await axios.post(nn_lib.nnbalance + credit_id + '/send',{
                            ToAccountId: credit_id1,
                            Amount: fee,
                            Comment: "Transferred to some other user"
                        },{
                            headers:{
                                'X-ApiKey': nn_lib.x_api,
                                'X-ApiKeyValidation': current_timestamp + '|' + hashHma1,
                                'X-Validation': current_timestamp + '|' + hashHma2
                            }
                        });
                        if(r.status == 200 && r.data && r.data.Data.FromBalance){
                            update_val = "";
                            balance = r.data.Data.FromBalance;
                        }
                        else{
                            update_val = "Database Failure";
                        }
                    }catch(e){
                        update_val = "Transferring Error";
                    }
                }
            }
            else{
                balance = -1;
            }
            if(update_val.trim() == ''){
                doc =await Follow.follow(following, userId ,fee);
            }
            if (doc){
                return res.json(utils.getResponseResult({isCreated: true, fuser: doc, credit_balance: balance}, 1, "Success."));
            }
            else{
                return res.json(utils.getResponseResult({}, 0, update_val));
            }
        }catch(e){
            return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
        }

    }catch(errs){
        return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
    }
});

router.post('/unfollow', auth.authenticate(), (req, res, next) => {
    const userId  = req.headers['user-id'];
    const following = req.body.following;

    Follow.checkFollow(following, userId).then((follow) => {
        if (follow == null) {
            return res.json(utils.getResponseResult({isRemoved: false}, 1, "Success."));
        }

        User.findById(following, (err, user) => {
            if (err) return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
            if (!user) return res.status(404).json(utils.getResponseResult({}, 0, "User not found"));
    
            Follow.unfollow(following, userId).then((doc) => {
                return res.json(utils.getResponseResult({isRemoved: true, fuser: doc}, 1, "Success."));
            }, (error) => {
                return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
            });
        });

    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
    });
});

router.get('/isFollowed/:following', auth.authenticate(), (req, res, next) => {
    const userId  = req.headers['user-id'];
    const following = req.params.following;

    Follow.checkFollow(following, userId).then((follow) => {
        if (follow != null) {
            return res.json(utils.getResponseResult({isFollowed: true}, 1, "Success."));
        }
        else {
            return res.json(utils.getResponseResult({isFollowed: false}, 1, "Success."));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, "database failure"));
    });
});



/**
 * Invite friend using email
 *  @param {*} userId 
 * @param {*} username
 * * @param {*} email 
 */

router.post('/inviteFriendWithEmail', auth.authenticate(), async (req, res, next) => {

    const userId = req.body.userId;
    const username = req.body.username;
    const friendEmail = req.body.email;

    aws.sendInvitationEmail(username, friendEmail, function (error, result) {

        if (error) {
            return res
                .status(404)
                .json(ResponseResult.getResponseResult({}, 0, "Failed to send the mail"));

        } else {
            res.json(ResponseResult.getResponseResult({}, 1, "Succeed to send the invitation mail."));

        }
    });
});

/**
 * Invite friend using Phone number
 */

router.post('/inviteFriendWithPhone', auth.authenticate(), async (req, res, next) => {
    const userId = req.body.userId;
    const username = req.body.username;
    const phoneNumber = req.body.phone;
    var message = 'Hi, ' + username + ' invited you to enjoy the app  : ' + '\n' + config.appstoreUrl + '\n' + config.googleUrl;

    twilio.sendSms(phoneNumber, message, function (data, code) {

        if (code == 1) {

            res.json(ResponseResult.getResponseResult({}, 1, "Succeed to send the invitation message."));
        } else {

            return res
                .status(404)
                .json(ResponseResult.getResponseResult({}, 0, "Failed to send SMS"));
        }
    })
});

module.exports = router;