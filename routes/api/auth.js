const express = require("express");
const router = express.Router();
const passport = require('passport');
const PassportError = require('./../../passport/passportError');
const Utils = require('./../../helpers/utils');
const Security_Admin = require('../../helpers/security_admin');
const Security = require('../../helpers/security');
const path = require('path');
const axios = require("axios");
const nn_lib = require('./../../shared/constant');

const User = require('../../models/user');
var bcrypt = require('../../helpers/bcrypt');

router.get('/', (req, res) => {
    res.json({ sessionID: req.sessionID, session: req.session });
});

router.post('/logout', (req, res) => {
    req.logout();

    req.session.destry();

    res.json({ success: true });
});


router.post('/login-nn', (reqs, res, next) => {
    let accessToken = reqs.body.accessToken;
    let refreshToken = reqs.body.refreshToken;
    let expires_in = 0;
    let token_create = 0;
    let result = {};

    const res_token = async() =>
    {
        try{
            if(reqs.body.rtoken == 1){
                try {
                    const r = await axios.post(nn_lib.oauthTokenUrl, {
                            grant_type: 'authorization_code',
                            client_id: nn_lib.clientId,
                            client_secret: nn_lib.clientSecret,
                            redirect_uri: '',
                            code: reqs.body.code,
                            code_verifier: reqs.body.code_verifier
                        },
                        {
                            headers: {'X-ApiKey': nn_lib.x_api}
                        });
                    if (r.status == 200 && r.data.access_token && r.data.refresh_token) {
                        accessToken = r.data.access_token;
                        refreshToken = r.data.refresh_token;
                        expires_in = r.data.expires_in
                        token_create = 1
                    } else {
                        accessToken = '';
                        refreshToken = '';
                        expires_in = 0;
                    }

                } catch (err) {
                    result = {};
                    result["success"] = 0;
                    result["error"] = "Error Occured";
                    res.json(result);
                }
            }
            else if(reqs.body.atoken == 1){
                try{
                    const r = await axios.post(nn_lib.oauthTokenUrl, {
                        grant_type: 'refresh_token',
                        client_id: nn_lib.clientId,
                        client_secret: nn_lib.clientSecret,
                        refresh_token: reqs.body.refreshToken,
                    },
                        {
                            headers: { 'X-ApiKey': nn_lib.x_api }
                        });
                    if(r.status == 200 && r.data){
                        accessToken = r.data.access_token;
                    }
                }catch(err){
                    try {
                        const r = await axios.post(nn_lib.oauthTokenUrl, {
                                grant_type: 'authorization_code',
                                client_id: nn_lib.clientId,
                                client_secret: nn_lib.clientSecret,
                                redirect_uri: '',
                                code: reqs.body.code,
                                code_verifier: reqs.body.code_verifier
                            },
                            {
                                headers: {'X-ApiKey': nn_lib.x_api}
                            });
                        if (r.status == 200 && r.data.access_token && r.data.refresh_token) {
                            accessToken = r.data.access_token;
                            refreshToken = r.data.refresh_token;
                            expires_in = r.data.expires_in
                            token_create = 1
                        } else {
                            accessToken = '';
                            refreshToken = '';
                            expires_in = 0;
                        }

                    } catch (err) {
                        result = {};
                        result["success"] = 0;
                        result["error"] = "Error Occured";
                        res.json(result);
                    }
                }
            }
            if(accessToken && refreshToken) {
                let config = {
                    headers: {
                        'Authorization': 'Bearer ' + accessToken,
                        'X-ApiKey': nn_lib.x_api
                    },
                }

                try{
                    let err_msg = '';
                    const uinfo =await axios.get(nn_lib.oauthUser, config);
                    if(uinfo.data && uinfo.data.name){
                        let req = {};
                        req.body = {};
                        req.body.username = uinfo.data.name;
                        req.body.socialId = uinfo.data.sub;
                        req.body.email = uinfo.data.email;
                        req.body.avatar = uinfo.data.picture;
                        req.body.type  = 4;
                        req.body.credit_id = uinfo.data.credit_id ? uinfo.data.credit_id : '';
                        req.body.credit_key = uinfo.data.credit_key ? uinfo.data.credit_key : '';
                        req.body.credit_balance = uinfo.data.credit_balance ? uinfo.data.credit_balance : 0;
                        if(!uinfo.data.email_verified){
                            err_msg = 'Email is not verified!';
                        }
                        else if(!uinfo.data.is_premium){
                            err_msg = 'premium';
                        }
                        else if(!uinfo.data.groups  || !uinfo.data.groups.includes('nfb')){
                            err_msg = 'You are not currently a member of the NF beta group. Please contact NN if you wish to be part of this group.';
                        }
                        if(err_msg.trim() == ''){
                            passport.authenticate('local-nn', (err, user, info) => {
                                if (err) {
                                    if(err.message){
                                        result = {};
                                        result["success"] = 0;
                                        result["error"] = err.message;
                                        res.json(result);
                                    }
                                    else return res.status(500).json(Utils.getResponseResult({}, 0, err.message));
                                } else {
                                    if (user) {
                                        Security.getToken(user.id, user.username, function (token) {
                                            result["user"] = uinfo;
                                            user["token"] = token;
                                            result["user"] = user;
                                            result["success"] = 1;
                                            result["error"] = "success";
                                            result['nn_token'] = {accessToken: accessToken,refreshToken: refreshToken, expires_in:expires_in, token_create: token_create}
                                            res.json(result);
                                        });
                                    }
                                }
                            })(req, res, next);
                        }
                        else{
                            result = {};
                            result["success"] = 0;
                            result["error"] = err_msg;
                            res.json(result);
                        }
                    }
                    else{
                        result = {};
                        result["success"] = 0;
                        result["error"] = "Error Occured";
                        res.json(result);
                    }
                }
                catch(err){
                    try {
                        const r = await axios.post(nn_lib.oauthTokenUrl, {
                                grant_type: 'authorization_code',
                                client_id: nn_lib.clientId,
                                client_secret: nn_lib.clientSecret,
                                redirect_uri: '',
                                code: reqs.body.code,
                                code_verifier: reqs.body.code_verifier
                            },
                            {
                                headers: {'X-ApiKey': nn_lib.x_api}
                            });
                        if (r.status == 200 && r.data.access_token && r.data.refresh_token) {
                            accessToken = r.data.access_token;
                            refreshToken = r.data.refresh_token;
                            expires_in = r.data.expires_in
                            token_create = 1
                        } else {
                            accessToken = '';
                            refreshToken = '';
                            expires_in = 0;
                            token_create = 0;
                        }

                    } catch (err) {
                        result = {};
                        result["success"] = 0;
                        result["error"] = "Error Occured";
                        res.json(result);
                    }
                    if(accessToken && refreshToken){
                        let config = {
                            headers: {
                                'Authorization': 'Bearer ' + accessToken,
                                'X-ApiKey': nn_lib.x_api
                            },
                        }
                        try{
                            let err_msg = '';
                            const uinfo =await axios.get(nn_lib.oauthUser, config);
                            if(uinfo.data && uinfo.data.name){
                                let req = {};
                                req.body = {};
                                req.body.username = uinfo.data.name;
                                req.body.socialId = uinfo.data.sub;
                                req.body.email = uinfo.data.email;
                                req.body.avatar = uinfo.data.picture;
                                req.body.type  = 4;
                                req.body.credit_id = uinfo.data.credit_id ? uinfo.data.credit_id : '';
                                req.body.credit_key = uinfo.data.credit_key ? uinfo.data.credit_key : '';
                                req.body.credit_balance = uinfo.data.credit_balance ? uinfo.data.credit_balance : 0;
                                if(!uinfo.data.email_verified){
                                    err_msg = 'Email is not verified!';
                                }
                                else if(!uinfo.data.is_premium){
                                    err_msg = '`premium`';
                                }
                                else if(!uinfo.data.groups  || !uinfo.data.groups.includes('nfb')){
                                    err_msg = 'You are not currently a member of the NF beta group. Please contact NN if you wish to be part of this group.';
                                }
                                if(err_msg.trim() == ''){
                                    passport.authenticate('local-nn', (err, user, info) => {
                                        if (err) {
                                            return res.status(500).json(Utils.getResponseResult({}, 0, err.message));
                                        } else {
                                            if (user) {
                                                Security.getToken(user.id, user.username, function (token) {
                                                    result["user"] = uinfo;
                                                    user["token"] = token;
                                                    result["user"] = user;
                                                    result["success"] = 1;
                                                    result["error"] = "success";
                                                    result['nn_token'] = {accessToken: accessToken,refreshToken: refreshToken, expires_in:expires_in, token_create: token_create}
                                                    res.json(result);
                                                });
                                            }
                                        }
                                    })(req, res, next);
                                }
                                else{
                                    result = {};
                                    result["success"] = 0;
                                    result["error"] = err_msg;
                                    res.json(result);
                                }
                            }
                            else{
                                result = {};
                                result["success"] = 0;
                                result["error"] = "Error Occured";
                                res.json(result);
                            }
                        }
                        catch(err){
                            result = {};
                            result["success"] = 0;
                            result["error"] = "Error Occured";
                            res.json(result);
                        }
                    }
                    else{
                        result = {};
                        result["success"] = 0;
                        result["error"] = "Error Occured";
                        res.json(result);
                    }
                }
            }
        }catch(err){
            result = {};
            result["success"] = 0;
            result["error"] = "Error Occured";
            res.json(result);
        }
    };

    res_token();

    // let config = {
    //     headers: {
    //         'Authorization': 'Bearer ' + reqs.body.accessToken,
    //         'X-ApiKey': nn_lib.x_api
    //     },
    // }
    // axios.get(nn_lib.oauthUser, config).then(function(uinfo){
    //     console.log(uinfo);
    // }).catch(function (error) {
    //     return res.json(utils.getResponseResult({}, 0, "token generate"));
    // });
    // axios.post(nn_lib.oauthTokenUrl, {
    //     grant_type: 'authorization_code',
    //     client_id: nn_lib.clientId,
    //     client_secret: nn_lib.clientSecret,
    //     redirect_uri: '',
    //     code: reqs.body.code,
    //     code_verifier: reqs.body.code_verifier
    // },
    // {
    //     headers: { 'X-ApiKey': nn_lib.x_api }
    // })
    // .then(function (response) {
    //
    //     if(response.data.access_token && response.data.refresh_token){
    //         result["success"] = 1;
    //         result["error"] = "success";
    //         result['data'] = response.data;
    //         res.json(result);
    //         const config = {
    //             headers: {
    //                 'Authorization': 'Bearer ' + response.data.access_token,
    //                 'X-ApiKey': nn_lib.x_api
    //             },
    //         }
    //         axios.get(nn_lib.oauthUser, config).then(function(uinfo){
    //             var result = {};
    //             result["user"] = uinfo;
    //             result["success"] = 1;
    //             result["error"] = "success";
    //             res.json(result);
    //             if(uinfo.data){
    //                 let req = {};
    //                 req.body = {};
    //                 req.body.username = uinfo.data.name;
    //                 req.body.socialId = uinfo.data.sub;
    //                 req.body.email = uinfo.data.email;
    //                 req.body.avatar = uinfo.data.picture;
    //                 req.body.type  = 4;
    //                 passport.authenticate('local-nn', (err, user, info) => {
    //                     if (err) {
    //                         return res.status(500).json(Utils.getResponseResult({}, 0, err.message));
    //                     } else {
    //
    //                         if (info) {
    //                             if (user) {
    //                                 Security.getToken(user.id, user.username, function (token) {
    //                                     user["token"] = token;
    //                                     result["user"] = user;
    //                                     result["success"] = 1;
    //                                     result["error"] = "success";
    //                                     res.json(result);
    //                                 });
    //                             }
    //                         } else {
    //                             Security.getToken(user.id, user.username, function (token) {
    //                                 user["token"] = token;
    //                                 result["user"] = user;
    //                                 result["success"] = 1;
    //                                 result["error"] = "success";
    //                                 res.json(result);
    //                             });
    //                         }
    //                     }
    //                 })(req, res, next);
    //             }
    //         })
    //         .catch(function (error) {
    //             console.log(error)
    //         })
    //     }
    // })
    // .catch(function (error) {
    //
    // })
});


router.post('/register', (req, res, next) => {
    passport.authenticate('local-register', (err, user, info) => {
        //it's either an error or a success
        var result = {};
        if (err) {

            result["success"] = 0;
            result["error"] = err.message;
            return res.json(result);
            
        }
        Security.getToken(user.id, user.username, function (token) {
            user["token"] = token;
            result["user"] = user;
            result["success"] = 1;
            result["error"] = "success";
            res.json(result);
        });

    })(req, res, next);
});

router.post('/login', (req, res, next) => {
    passport.authenticate('local-login', (err, user, info) => {
        var result = {};
        if (err) {
            if (err instanceof PassportError) {
                result["success"] = err.code;
                result["error"] = err.message;
                return res.json(result);
            }
            return next(err);
        } else {
            Security.getToken(user.id, user.username, function (token) {
                user["token"] = token;
                result["user"] = user;
                result["success"] = 1;
                result["error"] = "success";
                res.json(result);
            });
        }
    })(req, res, next);
});

router.post('/login_admin', (req, res, next) => {
    passport.authenticate('local-login-admin', (err, user, info) => {
        var result = {};
        if (err) {
            if (err instanceof PassportError) {
                result["success"] = err.code;
                result["error"] = err.message;
                return res.json(result);
            }
            return next(err);
        } else {
            Security_Admin.getToken(user.id, user.loginId, function (token) {
                user["token"] = token;
                result["user"] = user;
                result["success"] = 1;
                result["error"] = "success";
                res.json(result);
            });
        }
    })(req, res, next);
});

router.post('/loginuser', (req, res, next) => {
    passport.authenticate('local-loginuser', (err, user, info) => {
        var result = {};
        if (err) {
            if (err instanceof PassportError) {
                result["success"] = err.code;
                result["error"] = err.message;
                return res.json(result);
            }
            return next(err);
        } else {
            Security.getToken(user.id, user.username, function (token) {
                user["token"] = token;
                result["user"] = user;
                result["success"] = 1;
                result["error"] = "success";
                res.json(result);
            });
        }
    })(req, res, next);
});

router.post('/login-social', (req, res, next) => {
    passport.authenticate('local-social', (err, user, info) => {
        if (err) {
            return res.status(500).json(Utils.getResponseResult({}, 0, err.message));
        } else {
            var result = {};
            if (info) {
                if (user) {
                    Security.getToken(user.id, user.username, function (token) {
                        user["token"] = token;
                        result["user"] = user;
                        result["success"] = 1;
                        result["error"] = "success";
                        res.json(result);
                    });
                }
            } else {
                Security.getToken(user.id, user.username, function (token) {
                    user["token"] = token;
                    result["user"] = user;
                    result["success"] = 1;
                    result["error"] = "success";
                    res.json(result);
                });
            }
        }
    })(req, res, next);
});

router.post('/forget-password', (req, res, next) => {

    User.findUserByEmail(req.body.email).then(user => {
        console.log('user => ', user);
        if (!user) {
            return res.json({'success': 0, 'error': 'This email is not registered yet.'});
        }
        bcrypt.generateHash(req.body.password).then(hash => {
            User.findByIdAndUpdate(user.id, { password: hash }, { new: true }).then((doc) => {
                return res.json({'success':1});
            }, (error) => {
                return res.json({'success': 0, 'error': 'Failed to reset your password.'});
            });
        });
        
    });
});

router.get('/verify', (req, res, next) => {
    // let host = '18.236.105.144';
    // if ((req.protocol + '://' + req.get('host')) === ('http://' + host)) {

    // }

    let decodedMail = new Buffer(req.query.mail, 'base64').toString('ascii');
    User.findUserByEmail(decodedMail).then(user => {
        if (!user) {
            return done(new PassportError(0, 'INVALID USER'), null, null);
        }
        if (!user.isVerified) {
            user.isVerified = true;
            user.save().then((data) => {
                res.render('index', { title: 'You have been verified.' });
            });
        } else {
            res.render('index', { title: 'You have been verified.' });
        }
    });
});


async function generateToken(type = 1) {
    if (type == 1) {
        try {
            const r = await axios.post(nn_lib.oauthTokenUrl, {
                    grant_type: 'authorization_code',
                    client_id: nn_lib.clientId,
                    client_secret: nn_lib.clientSecret,
                    redirect_uri: '',
                    code: reqs.body.code,
                    code_verifier: reqs.body.code_verifier
                },
                {
                    headers: {'X-ApiKey': nn_lib.x_api}
                });
            if (r.status == 200 && r.data.access_token && r.data.refresh_token) {
                accessToken = r.data.access_token;
                refreshToken = r.data.refresh_token;
                expires_in = r.data.expires_in
                token_create = 1
            } else {
                accessToken = '';
                refreshToken = '';
                expires_in = 0;
            }
            return Promise.resolve(r);

        } catch (err) {
            return null;
        }
    }
}

module.exports = router;
