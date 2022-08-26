var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var User = require('./../models/user');
var Admin = require('./../models/admin');
var bcrypt = require('./../helpers/bcrypt');
var PassportError = require('./passportError');
var cache = require('./../helpers/cache');
var utils = require('./../helpers/utils');
var aws = require('./../helpers/aws');
var crypto = require("crypto");
/**
 * Set up passport serialization
 */

passport.serializeUser((user, done) => {
    cache.passport.set(user._id, user); //store user in cache
    done(null, user._id);
});

passport.deserializeUser((id, done) => {
    if (cache.passport.has(id)) {
        return done(null, cache.passport.get(id));
    }
    User.findById(id).exec().then((user) => {
        cache.passport.set(id, user);
        done(null, user);
    }
    ).catch((error) => {
        done(error);
    });
});

passport.use(new FacebookStrategy({
    clientID: "1023879140982814",
    clientSecret: "4c3a3fd2f334952b951593a06280196e",
    callbackURL: 'http://localhost:3000/login'
},
    function (accessToken, refreshToken, profile, cb) {
        console.log('access => ', accessToken);
        return cb(null, profile);
    }));
// signup
passport.use('local-register', new LocalStrategy({ passReqToCallback: true }, (req, username, password, done) => {
    // when only email register
    const email = req.body.email;
    const fullname = req.body.fullName;
    User.findUserByEmail(email).then((user) => {
        if (user) {
            return done(new PassportError(0, 'Email exists'), null, null);
        }
        User.findUser(username).then((_user) => {
            if (_user) {
                return done(new PassportError(0, 'Username exists'), null, null);
            }

            let rand = Math.floor((Math.random() * 100) + 54);


            // aws.sendVerificationEmail(req, email, username, rand, function (err, data) {
            //     if (data) {
            //         console.log("data => error => ", data, err);
                    bcrypt.generateHash(password).then(hash => {
                        const newUser = new User();
                        newUser.username = username;
                        newUser.email = email;
                        newUser.password = hash;
                        newUser.type = 1; //email
                        newUser.isVerified = true;
                        newUser.name = fullname;
                        newUser.save().then((doc) => {
                            return done(null, utils.customizedUserInfo(doc), null);
                        }, (error) => {
                            return done(error);
                        });
                    });
            //     } else {
            //         console.log("data => error => ", data, err);
            //         return done(err);
            //     }
            // });
        });
    });
}));

// login
passport.use('local-login-admin', new LocalStrategy({
    usernameField: 'loginId',
    passwordField: 'password',
    passReqToCallback: true
}, (req, loginId, password, done) => {
    let _user = undefined;
    if (!loginId) {
        return done(new PassportError(-1, 'Username is required'), null, null);
    }
    Admin.findUserById(loginId).then(user => {

        if (!user) {
            return done(new PassportError(0, 'Username is not exist'), null, null);
        }
        else{
            _user = user;
            if(user.password == password){
                return done(null, utils.customizedUserInfoAdmin(user), null);
            }
            else{
                return done(new PassportError(0, 'Password is wrong'), null, null);
            }
        }
    });
}));

passport.use('local-login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
}, (req, email, password, done) => {
    let _user = undefined;
    if (!email) {
        return done(new PassportError(-1, 'Email is required'), null, null);
    }
    User.findUserByEmail(email).then(user => {

        if (!user) {
            return done(new PassportError(0, 'Email is not exist'), null, null);
        }
        if (user.isVerified) {
            _user = user;
            bcrypt.compareHash(user.password, password).then(result => {
                if (result) {
                    return done(null, utils.customizedUserInfo(user), null);
                } else {
                    return done(new PassportError(0, 'Password is wrong'), null, null);
                }
            }).catch(error => {
                return done(new PassportError(0, 'INVALID AUTH'), null, null);
            });
        } else {
            return done(new PassportError(0, 'You have been not verified yet.'), null, null);
        }
    });
}));

passport.use('local-loginuser', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, (req, username, password, done) => {
    let _user = undefined;
    if (!username) {
        return done(new PassportError(-1, 'Username is required'), null, null);
    }

    User.findUser(username).then(user => {
        if (!user) {
            return done(new PassportError(0, 'Username is not exist'), null, null);
        }
        if (user.isVerified) {
            _user = user;
            bcrypt.compareHash(user.password, password).then(result => {
                if (result) {
                    return done(null, utils.customizedUserInfo(user), null);
                } else {
                    return done(new PassportError(0, 'Password is wrong'), null, null);
                }
            }).catch(error => {
                return done(new PassportError(0, 'INVALID AUTH'), null, null);
            });
        } else {
            return done(new PassportError(0, 'You have been not verified yet.'), null, null);
        }
    });
}));

passport.use('local-nn', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'socialId',
    passReqToCallback: true
}, (req ,username, socialId, done) => {
        let cur_username = req.body.username;
        User.findUserByNN(req.body.socialId).then((user) => {
            if (user) {
                User.updateNNValue(user._id,req.body.credit_id,req.body.credit_key,req.body.credit_balance,req.body.socialId).then(u=>{
                    return done(null, utils.customizedUserInfo(user), '1');
                },err => {
                    return done(null, utils.customizedUserInfo(user), '1');
                });

            } else {
                User.findUser(req.body.username).then(_user => {
                    if (_user) {
                        cur_username += '_' + crypto.randomBytes(6).toString('hex');
                    }
                    const newUser = new User();
                    newUser.type = req.body.type; // nnNude
                    newUser.o_auth.nn_network.id = req.body.socialId;
                    newUser.o_auth.nn_network.credit_id = req.body.credit_id;
                    newUser.o_auth.nn_network.credit_key = req.body.credit_key;
                    newUser.o_auth.nn_network.credit_balance = req.body.credit_balance;
                    newUser.username = cur_username;
                    newUser.isVerified = true;
                    if (req.body.email) newUser.email = req.body.email;
                    if (req.body.avatar) newUser.avatar = req.body.avatar;
                    newUser.save().then((doc) => {
                        return done(null, utils.customizedUserInfo(doc), null);
                    },err => {
                        err_msg = '';
                        if(err.errors && err.errors.email && err.errors.email.kind == 'unique' ) {
                            err_msg = 'Your email already exists in our system, please login with your other account';
                        }
                        return done(new PassportError(0, err_msg), null, null);
                    });
                });
            }
        })
}
));

// social
passport.use('local-social', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'socialId',
    passReqToCallback: true
}, (req, username, socialId, done) => {
    const type = req.body.type;
    let cur_username = username;
    if (type == 2) { // facebook
        User.findUserByFacebookId(socialId).then((user) => {
            if (user) {
                return done(null, utils.customizedUserInfo(user), '1');
            } else {
                User.findUser(username).then(_user => {
                    if (_user) {
                        cur_username +='_' + crypto.randomBytes(6).toString('hex');
                    }
                    const newUser = new User();
                    newUser.type = 2; // facebook
                    newUser.o_auth.facebook.id = socialId;
                    newUser.o_auth.facebook.access_token = req.body.access_token;
                    newUser.username = cur_username;
                    newUser.isVerified = true;
                    if (req.body.email) newUser.email = req.body.email;
                    if (req.body.avatar) newUser.avatar = req.body.avatar;
                    if (req.body.firstName) newUser.firstName = req.body.firstName;
                    if (req.body.lastName) newUser.lastName = req.body.lastName;
                    if (req.body.age) newUser.age = req.body.age;
                    if (req.body.gender) newUser.gender = req.body.gender;
                    newUser.save().then((doc) => {
                        return done(null, utils.customizedUserInfo(doc), null);
                    });
                });
            }
        })
    } else if (type == 3) { // google
        User.findUserByGoogleId(socialId).then((user) => {
            if (user) {
                return done(null, utils.customizedUserInfo(user), '1');
            } else {
                User.findUser(username).then(_user => {
                    if (_user) {
                        cur_username += '_' + crypto.randomBytes(6).toString('hex');
                    }
                    const newUser = new User();
                    newUser.type = 3; // google
                    newUser.o_auth.google.id = socialId;
                    newUser.username = cur_username;
                    newUser.isVerified = true;
                    if (req.body.access_token)
                        newUser.o_auth.google.access_token = req.body.access_token;
                    if (req.body.email) newUser.email = req.body.email;
                    if (req.body.avatar) newUser.avatar = req.body.avatar;
                    newUser.save().then((doc) => {
                        return done(null, utils.customizedUserInfo(doc), null);
                    });
                });
            }
        })
    }

    else if (type == 4) { // google
        User.findUserByNN(socialId).then((user) => {
            if (user) {
                return done(null, utils.customizedUserInfo(user), '1');
            } else {
                User.findUser(username).then(_user => {
                    if (_user) {
                        cur_username += '_' + crypto.randomBytes(6).toString('hex');
                    }
                    const newUser = new User();
                    newUser.type = 4; // google
                    newUser.o_auth.nn_network.id = socialId;
                    newUser.username = cur_username;
                    newUser.isVerified = true;
                    if (req.body.access_token)
                        newUser.o_auth.nn_network.access_token = req.body.access_token;
                    if (req.body.email) newUser.email = req.body.email;
                    if (req.body.avatar) newUser.avatar = req.body.avatar;
                    newUser.save().then((doc) => {
                        return done(null, utils.customizedUserInfo(doc), null);
                    },err => {
                        console.log(err)
                    });
                });
            }
        })
    }
}
));

