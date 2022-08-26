var passport  = require("passport");
var passportJWT = require('passport-jwt');
var Admin = require("../models/admin");
var config = require('../config');
var ExtractJwt = passportJWT.ExtractJwt;
var Strategy = passportJWT.Strategy;

var opts = {
    secretOrKey: config.secret_admin,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
}

module.exports = function () {

    var strategy = new Strategy(opts, function(payload, done) {

        Admin.findById(payload.id, function(err, user) {
            if (user) {
                return done(null, {id: user.id, payload: user});
            }else {
                return done(new Error("User not found"), null);
            }
        });
    });
    passport.use("jwt-auth",strategy);
    return {
        initialize: function() {
            return passport.initialize();
        },
        authenticate: function () {
            return passport.authenticate("jwt-auth", {session: false});
        }
    };
};