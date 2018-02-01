'use strict';

const express = require('express');
const newrelic = require('newrelic');

const router = express.Router({mergeParams: true});

router.get('/health', function (req, res) {
    newrelic.setIgnoreTransaction(true);
    res.send('OK');
});

module.exports = router;
