'use strict';

async function createServer () {
    // Configuration
    const { config } = require('@tapps-games/core');
    await config.load('env');
    await config.load('json', 'config.json');

    // Server
    const { AutoServer, middlewares } = require('@tapps-games/server');
    const bodyParser = require('body-parser');

    const server = new AutoServer();

    server.pre(bodyParser.json({limit: '10mb'}));
    server.pre(middlewares.validateSharedCloudSecret());
    server.pre(middlewares.validateUserIdAndServiceAccountName());
    server.pre(middlewares.validateBundleId());

    // Use OpenAPI to validate requests and responses.
    // await server.openApi({
    //     specFilePath: 'api-spec/[service-name].yaml',
    //     handlers: routes,
    // });

    // Add server routers/routes without OpenAPI validation.
    // server.route('/path', routes);

    return server;
}

module.exports = {
    createServer,
};
