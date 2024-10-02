'use strict';

startTracer();

(async function () {
    const { config } = require('@by-aliens-tooling/core');
    await config.load('env');
    await config.load('json', './configuration/config.json');

    const { Logger } = require('@by-aliens-tooling/logging');
    const logger = new Logger();
    process.on('unhandledRejection', error => {
        logger.error(`Unhandled Promise Rejection: ${error.message}`, error);
    });

    const { createServer } = require('./server');
    await createServer();
})();

function startTracer() {
    const env = process.env.ENV.toLowerCase();

    if (env !== 'test') {
        const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.DATASTORE_PROJECT_ID || 'test';

        // We use default logger as gcloud recommends loading its tracer as early as possible
        // eslint-disable-next-line no-console
        console.info(`[TRACER] Starting tracer for project ${project}`);

        require('@google-cloud/trace-agent').start({
            logLevel: env === 'local' ? 4 : 1, // Log levels: 0=disabled, 1=error, 2=warn, 3=info, 4=debug
            projectId: project,
            serviceContext: {
                service: process.env.SERVICE_NAME,
                version: process.env.SERVICE_VERSION,
            },
            ignoreUrls: [
                '/liveness-check',
                '/readiness-check',
            ],
        });
    }
}
