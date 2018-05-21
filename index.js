'use strict';

// The New Relic require has to be the first thing to run!
const newrelic = require('newrelic');
const appmetrics = require('appmetrics');
appmetrics.start();
const instrumentation = require('./datastore-instrumentation');
newrelic.instrumentDatastore('@google-cloud/datastore', instrumentation);

const cluster = require('cluster');
const tpCommon = require('tp-common');

const config = require('./config');
const server = require('./server');
const logShipper = require('./log-shipper');

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

if (cluster.isMaster && process.env.NODE_ENV !== 'test') {
    let spawners = {
        server: spawnServer,
        worker: spawnWorker,
    };

    // Spawn a web server for each CPU core.
    let numServerWorkers = require('os').cpus().length;
    logger.info('Master cluster setting up ' + numServerWorkers + ' web server worker(s).');
    for (let i = numServerWorkers; i > 0; i--) {
        spawnServer();
    }

    // Start our log shipper.
    logShipper.start();

    cluster.on('online', worker => {
        let role = clusterMap.ids[worker.id];
        logger.info(role + ' worker ' + worker.id + ' is online!');
        clusterMap.workers[role] = clusterMap.workers[role] || {};
        clusterMap.workers[role][worker.id] = worker;
    });

    cluster.on('exit', (worker, code, signal) => {
        let role = clusterMap.ids[worker.id];
        logger.info(role + ' worker ' + worker.id + ' died with code: ' + code + ', and signal: ' + signal);
        logger.info('Starting a new ' + role + ' worker.');
        delete clusterMap.workers[role][worker.id];
        spawners[role]();
    });
} else {
    switch (process.env.ROLE) {
        case 'server':
            server.start();
            break;
    }
}
