'use strict';

// The New Relic require has to be the first thing to run!
const newrelic   = require('newrelic');
const bodyParser = require('body-parser');
const express    = require('express');

const Middleware = require('tp-common/middleware');
const Logger     = require('tp-common/logger');

const config     = require('./config');
const middleware = new Middleware(config);
const logger     = new Logger(config);

const app = express();
app.set('trust proxy', true);

// Middlewares
app.use(middleware.responseTime.bind(middleware));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(middleware.security.bind(middleware));

// API Endpoints
// app.use('/endpoint/route/:var', require('./routes/file-that-contains-the-endpoint'));

// Health Check
app.use('/_ah', require('./routes/health-check'));

// Error Handling Middlewares
middleware.updateValidRoutes(app);
app.use(middleware.notFoundHandler.bind(middleware));
app.use(middleware.errorHandler.bind(middleware));

if (module === require.main) {
    // Start the server
    const server = app.listen(process.env.PORT || config.port, () => {
        const port = server.address().port;
        logger.notice('App listening on port ' + port);
    });
}

module.exports = app;