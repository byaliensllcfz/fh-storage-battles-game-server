'use strict';

require('dd-trace').init({
    tags: {
        instance: process.env.HOSTNAME,
        project: process.env.GOOGLE_CLOUD_PROJECT,
        project_id: process.env.GOOGLE_CLOUD_PROJECT,
        version: process.env.SERVICE_DEPLOY_VERSION,
        service: process.env.SERVICE_DEPLOY_ID,
    },
    enabled: !(process.env.DD_TRACE_DISABLED == 'true'),
    env: process.env.ENV,
    service: process.env.SERVICE_DEPLOY_ID,
    logInjection: true,
    runtimeMetrics: true,
});

(async function () {
    const { config } = require('@tapps-games/core');
    await config.load('env');
    await config.load('json', './configuration/config.json');

    const { Logger } = require('@tapps-games/logging');
    const logger = new Logger();
    process.on('unhandledRejection', error => {
        logger.error(`Unhandled Promise Rejection: ${error.message}`, error);
    });

    const { createServer } = require('./server');
    await createServer();
})();
