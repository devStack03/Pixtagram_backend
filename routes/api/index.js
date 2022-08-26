var express = require('express');
var router = express.Router();
var auth = require('./auth');
const path = require('path');
router.use('/auth', auth);
router.use('/post', require('./post'));
router.use('/like', require('./like'));
router.use('/comment', require('./comment'));
router.use('/user', require('./user'));
router.use('/bookmark', require('./bookmark'));
router.use('/friend', require('./friend'));
router.use('/chat', require('./chat'));
router.use('/report', require('./report'));
router.use('/reports', require('./reports'));
router.use('/contacts', require('./contacts'));
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;