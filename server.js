'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const Logger = require('tp-common/logger');
const Middleware = require('tp-common/middleware');
const Util = require('tp-common/util');

const config = require('./config');
const errors = require('./errors');

const logger = new Logger(config);
const middleware = new Middleware(config);
const util = new Util(config);

function createApp () {
    let app = express();
    app.set('trust proxy', true);

    app.use(middleware.responseTime.bind(middleware));
    app.use('/_ah', require('./routes/health-check')); // Only responseTime is needed, to log the application's metrics.

    // Middlewares
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(middleware.notFoundHandler.bind(middleware));
    app.use(middleware.security.bind(middleware));

    // API Endpoints
    // app.use('/endpoint/route/:var', require('./routes/file-that-contains-the-endpoint'));

    // Error Handling Middlewares
    middleware.updateValidRoutes(app);
    app.use(middleware.errorHandler.bind(middleware));

    util.addErrors(errors);

    return app;
}

function start () {
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
