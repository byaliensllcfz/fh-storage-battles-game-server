'use strict';

// The Datadog require has to be the first thing to run!
const config = require('./config');
require('dd-trace').init({
    tags: {
        instance: process.env.GAE_INSTANCE,
        project: config.gcloud_project,
        project_id: config.gcloud_project,
        version: config.service_deploy_version,
    },
    enabled: true,
    env: config.env,
    service: config.service_deploy_id,
});
const StatsD = require('hot-shots');
new StatsD({
    port: 8125,
    globalTags: {
        instance: process.env.GAE_INSTANCE,
        project: config.gcloud_project,
        project_id: config.gcloud_project,
        version: config.service_deploy_version,
        service: config.service_deploy_id,
    },
    prefix: `tapps.${config.service_name}.`,
});

const cluster = require('cluster');
const datadogHandler = require('./lib/datadog-handler');
const server = require('./server');
const tpCommon = require('tp-common');

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

    // Start our datadog agent and trace agent.
    datadogHandler.startDatadogAgent(config);
    datadogHandler.startTraceAgent(config);

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
