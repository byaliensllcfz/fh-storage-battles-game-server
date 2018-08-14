'use strict';

// The New Relic require has to be the first thing to run!
const newrelic = require('newrelic');
const appmetrics = require('appmetrics');
appmetrics.start();

const tpCommon = require('tp-common');
newrelic.instrumentDatastore('@google-cloud/datastore', tpCommon.datastoreInstrumentation);

const cluster = require('cluster');
const config = require('./config');
const server = require('./server');

const logShipper = tpCommon.logShipper;
const metrics = tpCommon.metrics;
const logger = new tpCommon.Logger(config);

let clusterMap = {
    ids: {},
    workers: {},
};

function spawnServer() {
    const role = 'server';
    let server = cluster.fork({
        ROLE: role,
    });
    clusterMap.ids[server.id] = role;
}

function spawnWorker() {
    const role = 'worker';
    let worker = cluster.fork({
        ROLE: role,
    });
    clusterMap.ids[worker.id] = role;
}

if (cluster.isMaster && process.env.NODE_ENV === 'production') {
    let spawners = {
        server: spawnServer,
        worker: spawnWorker,
    };

    // Spawn a web server for each CPU core.
    let numServerWorkers = require('os').cpus().length;
    logger.info(`Master cluster setting up ${numServerWorkers} web server worker(s).`);
    for (let i = numServerWorkers; i > 0; i--) {
        spawnServer();
    }

    // Start our log shipper.
    logShipper.start(config);

    // Start monitoring the applications's metrics.
    metrics.start(config);

    cluster.on('online', worker => {
        let role = clusterMap.ids[worker.id];
        logger.info(`${role} worker ${worker.id} is online!`);
        clusterMap.workers[role] = clusterMap.workers[role] || {};
        clusterMap.workers[role][worker.id] = worker;
    });

    cluster.on('exit', (worker, code, signal) => {
        let role = clusterMap.ids[worker.id];
        logger.info(`${role} worker ${worker.id} died with code: ${code}, and signal: ${signal}.`);
        logger.info(`Starting a new ${role} worker.`);
        delete clusterMap.workers[role][worker.id];
        spawners[role]();
    });
} else {
    switch (process.env.ROLE) {
        case 'server': {
            server.createApp()
                .then(app => {
                    server.start(app);
                })
                .catch(error => {
                    logger.error({
                        error: error,
                        message: 'Failed to create app server. Aborting...',
                    });

                    throw error;
                });
            break;
        }
        default:
            throw new Error(`Attempting to start a worker with unknown role: ${process.env.ROLE}.`);
    }
}
