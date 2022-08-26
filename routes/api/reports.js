var express = require("express");
var utils = require('./../../helpers/utils');
var admin = require('./../../middlewares/admin')();
var Report = require('../../models/report');
const router = express.Router();

router.post('/', admin.authenticate(), (req, res, next) => {
    res.json(utils.getResponseResult(1, 1, ''));
});

router.get('/getAll', admin.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];

    Report.getAll().then((reports) => {
        if (reports) {
            res.json(utils.getResponseResult(reports, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, 'Report Not Found'));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.post('/updateFlag', admin.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    var id = req.body.id;
    Report.updateFlagg(id).then( (data) => {
       if (data) {
           res.json(utils.getResponseResult('', 1, ''));
       }
       else {
           res.json(utils.getResponseResult('', 0, ''));
       }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult(error, 0, 'Database error'));
    });
});

router.post('/createReply', admin.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    var id = req.body.id;
    var description = req.body.description;
    Report.ceateReply(id,description).then( (data) => {
        if (data) {
            res.json(utils.getResponseResult(data, 1, ''));
        }
        else {
            res.json(utils.getResponseResult('', 0, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult(error, 0, 'Database error'));
    });
});

router.post('/deleteReports', admin.authenticate(), (req, res, next)=>{
    const userId = req.headers['user-id'];
    var ids = req.body.ids;
    Report.deleteReports(ids).then( (data) => {
      if (data) {
          res.json(utils.getResponseResult('', 1, ''));
      }
      else {
          res.json(utils.getResponseResult('', 0, ''));
      }
    });
});

module.exports = router;