'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const tpCommon = require('tp-common');

const config = require('./config');
const errors = require('./errors');

const logger = new tpCommon.Logger(config);
const middleware = new tpCommon.Middleware(config);
const util = new tpCommon.Util(config);

async function createApp () {
    let app = express();
    app.set('trust proxy', true);

    app.use('/_ah/health', tpCommon.routers.healthCheck());
    app.use('/resource-status', tpCommon.routers.resourceStatus(config));

    // Middlewares
    app.use(middleware.responseTime.bind(middleware));
    app.use(bodyParser.json({limit: '10mb'}));
    app.use(middleware.notFoundHandler.bind(middleware));
    app.use(middleware.security.bind(middleware)); // FIXME: TP Server Services only
    app.use(middleware.authenticateTPServer.bind(middleware)); // FIXME: TP Server Services only
    app.use(middleware.authenticateGameServer.bind(middleware)); // FIXME: Game Servers only

    // API Endpoints
    // app.use('/endpoint/route/:var', require('./routes/file-that-contains-the-endpoint'));

    // Error Handling Middlewares
    middleware.updateValidRoutes(app);
    app.use(middleware.errorHandler.bind(middleware));

    util.addErrors(errors);

    return app;
}

function start(app) {
    // Start the server
    const server = app.listen(process.env.PORT || config.port, () => {
        const port = server.address().port;
        logger.notice(`Process ${process.pid} is listening to incoming requests on port ${port}.`);
    });
    return server;
}

module.exports = {
    createApp,
    start,
};
