'use strict';

const appmetrics = require('appmetrics');
const config = require('../config');
const express = require('express');
const newrelic = require('newrelic');
const Util = require('tp-common/util');

const router = express.Router({mergeParams: true});
const util = new Util(config);

const metrics = {};
const monitoring = appmetrics.monitor();

monitoring.on('cpu', data => metrics.cpu = data);
monitoring.on('eventloop', data => metrics.eventloop = data.latency);
monitoring.on('gc', data => metrics.gc = data);
monitoring.on('loop', data => metrics.loop = data);
monitoring.on('memory', data => metrics.memory = data);

router.get('/health', (req, res) => {
    newrelic.setIgnoreTransaction(true);
    util.successResponse(res, 200, metrics);
});

module.exports = router;
