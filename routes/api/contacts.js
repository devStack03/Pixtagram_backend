var express = require("express");
var utils = require('./../../helpers/utils');
var admin = require('./../../middlewares/admin')();
var User = require('../../models/user');
const router = express.Router();

router.post('/', admin.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    User.getAll().then((users) => {
        if (users) {
            res.json(utils.getResponseResult(users, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, 'Report Not Found'));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

module.exports = router;