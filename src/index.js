'use strict';

// The Datadog require has to be the first thing to run!
require('@tapps-games/datadog');

(async function () {
    const { config } = require('@tapps-games/core');
    const kubernetesEnv = process.env.KUBERNETES_ENV;

    await config.load('env');
    await config.load('json', `configs/${kubernetesEnv}/config.json`);

    const { Logger } = require('@tapps-games/logging');
    const logger = new Logger();
    process.on('unhandledRejection', error => {
        logger.error(`Unhandled Promise Rejection: ${error.message}`, error);
    });

    const { createServer } = require('./server');
    await createServer();
})();
