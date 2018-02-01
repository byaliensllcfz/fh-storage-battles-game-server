'use strict';

// The New Relic require has to be the first thing to run!
const newrelic = require('newrelic');
const instrumentation = require('./datastore-instrumentation');
newrelic.instrumentDatastore('@google-cloud/datastore', instrumentation);

const bodyParser = require('body-parser');
const cluster = require('cluster');
const express = require('express');

const Logger = require('tp-common/logger');
const Middleware = require('tp-common/middleware');
const Util = require('tp-common/util');
const config = require('./config');
const errors = require('./errors');

const logger = new Logger(config);
const middleware = new Middleware(config);
const util = new Util(config);

let app;

if(cluster.isMaster && process.env.NODE_ENV !== 'test') {
    let numWorkers = require('os').cpus().length;

    logger.notice('Master cluster setting up ' + numWorkers + ' workers...');

    for (let i = numWorkers; i > 0; i--) {
        cluster.fork();
    }

    cluster.on('online', (worker) => {
        logger.notice('Worker ' + worker.process.pid + ' is online');
    });

    cluster.on('exit', (worker, code, signal) => {
        logger.notice('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        logger.notice('Starting a new worker');
        cluster.fork();
    });
} else {
    app = express();
    app.set('trust proxy', true);

    // Middlewares
    app.use(middleware.responseTime.bind(middleware));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(middleware.notFoundHandler.bind(middleware));
    app.use(middleware.security.bind(middleware));

    // API Endpoints
    // app.use('/endpoint/route/:var', require('./routes/file-that-contains-the-endpoint'));

    // Health Check
    app.use('/_ah', require('./routes/health-check'));

    // Error Handling Middlewares
    middleware.updateValidRoutes(app);
    app.use(middleware.errorHandler.bind(middleware));

    util.addErrors(errors);

    if (process.env.NODE_ENV !== 'test') {
        // Start the server
        const server = app.listen(process.env.PORT || config.port, () => {
            const port = server.address().port;
            logger.notice('Process ' + process.pid + ' is listening to incoming requests on port ' + port);
        });
    }
}

module.exports = app;
