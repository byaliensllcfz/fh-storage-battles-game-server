'use strict';

const express = require('express');
const router  = express.Router();

// Specify valid methods for the 405 handler
router.all('/health', function (req, res, next) {
    res.locals.methods = ['GET'];
    next();
});

router.get('/health', function(req, res) {
    res.send('OK');
});

module.exports = router;