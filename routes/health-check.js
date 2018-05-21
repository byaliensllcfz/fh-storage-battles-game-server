'use strict';

const appmetrics = require('appmetrics');
const config = require('../config');
const express = require('express');
const newrelic = require('newrelic');
const Logger = require('tp-common').Logger;

const router = express.Router({mergeParams: true});
const logger = new Logger(config);

const metrics = {};
const monitoring = appmetrics.monitor();
monitoring.on('cpu', data => {
    metrics.cpu = data;
    logger.info(metrics);
});
monitoring.on('eventloop', data => metrics.eventloop = data.latency);
monitoring.on('gc', data => metrics.gc = data);
monitoring.on('loop', data => metrics.loop = data);
monitoring.on('memory', data => metrics.memory = data);

router.get('/health', function (_req, res) {
    newrelic.setIgnoreTransaction(true);
    res.send('OK');
});

module.exports = router;
