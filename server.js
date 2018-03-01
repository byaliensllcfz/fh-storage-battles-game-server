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

let cluster_map = {
    ids: {},
    workers: {},
};
let app;

function spawnServer () {
    const role = 'server';
    let server = cluster.fork({ROLE: role});
    cluster_map.ids[server.id] = role;
}

function spawnWorker () {
    const role = 'worker';
    let worker = cluster.fork({ROLE: role});
    cluster_map.ids[worker.id] = role;
}

if(cluster.isMaster && process.env.NODE_ENV !== 'test') {
    let spawners = {
        'server': spawnServer,
        'worker': spawnWorker,
    };

    // Spawn a web server for each CPU core.
    let numServerWorkers = require('os').cpus().length;
    logger.notice('Master cluster setting up ' + numServerWorkers + ' web server worker(s).');
    for (let i = numServerWorkers; i > 0; i--) {
        spawnServer();
    }

    // Spawn additional workers.
    // logger.notice('Master cluster setting up a worker.');
    // spawnWorker();

    cluster.on('online', worker => {
        let role = cluster_map.ids[worker.id];
        logger.notice(role + ' worker ' + worker.id + ' is online!');
        cluster_map.workers[role] = cluster_map.workers[role] || {};
        cluster_map.workers[role][worker.id] = worker;
    });

    cluster.on('exit', (worker, code, signal) => {
        let role = cluster_map.ids[worker.id];
        logger.notice(role + ' worker ' + worker.id + ' died with code: ' + code + ', and signal: ' + signal);
        logger.notice('Starting a new ' + role + ' worker.');
        delete cluster_map.workers[role][worker.id];
        spawners[role]();
    });
} else {
    if (process.env.ROLE === 'server') {
        app = express();
        app.set('trust proxy', true);

        // Middlewares
        app.use(middleware.responseTime.bind(middleware));
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({extended: false}));
        app.use(middleware.notFoundHandler.bind(middleware));
        app.use(middleware.security.bind(middleware));

        // Health Check
        app.use('/_ah', require('./routes/health-check'));
        middleware.addAuthenticationExceptionRoute('/_ah/health');

        // API Endpoints
        // app.use('/endpoint/route/:var', require('./routes/file-that-contains-the-endpoint'));

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
}

module.exports = app;
