'use strict';

const express = require('express');
var newrelic  = require('newrelic');

const router = express.Router();

router.get('/health', function(req, res) {
    newrelic.setIgnoreTransaction(true);
    res.send('OK');
});

module.exports = router;