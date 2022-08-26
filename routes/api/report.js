var express = require("express");
var utils = require('./../../helpers/utils');
var Report = require('./../../models/report');
var auth = require('./../../middlewares/auth')();
var mail = require('../../helpers/aws');
const router = express.Router();

router.post('/', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    Report.createNewPost(userId, req.body).then((post) => {
        if (post) {
            let message = "<div><strong>" + post.owner.username + "</strong>";
            message += " reported bug";
            message += "</div>";
            message += "<div>" + post.title;
            message += "</div>";
            if(post.media && post.type == 2){
                message += "<img src='"+post.media+"' style='max-width:620px;width:100%;margin-top:20px;margin-bottom:20px;display:block'/>";
            }
            mail.sendGridSendMail('admin','Bug Report',message,function(err,data){
                console.log(data);
            });
            res.json(utils.getResponseResult(post, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.post('/getReports' , auth.authenticate(),(req, res, next) => {
    const userId = req.headers['user-id'];
    const from = req.body.from;
    const to = req.body.to;
    Report.getReportFrom(from,to,userId).then((post) => {
        if (post) {
            res.json(utils.getResponseResult(post, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});


module.exports = router;