'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const tpCommon = require('tp-common');

const config = require('./config');
const errors = require('./errors');

const logger = new tpCommon.Logger(config);
const middleware = new tpCommon.Middleware(config);
const util = new tpCommon.Util(config);

function createApp () {
    let app = express();
    app.set('trust proxy', true);

    app.use('/_ah', require('./routes/health-check'));

    // Middlewares
    app.use(middleware.responseTime.bind(middleware));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(middleware.notFoundHandler.bind(middleware));
    app.use(middleware.security.bind(middleware));
    app.use(middleware.authenticateTPServer.bind(middleware));
    // app.use(middleware.authenticateGameServer.bind(middleware));

    // API Endpoints
    // app.use('/endpoint/route/:var', require('./routes/file-that-contains-the-endpoint'));

    // Error Handling Middlewares
    middleware.updateValidRoutes(app);
    app.use(middleware.errorHandler.bind(middleware));

    util.addErrors(errors);

    return app;
}

function start() {
    const app = createApp();
    // Start the server
    const server = app.listen(process.env.PORT || config.port, () => {
        const port = server.address().port;
        logger.notice('Process ' + process.pid + ' is listening to incoming requests on port ' + port);
    });
    return server;
}

module.exports = {
    createApp,
    start,
};
