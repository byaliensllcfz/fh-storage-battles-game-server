'use strict';

const COLYSEUS_PORT = 2567;

const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

async function createServer () {
    const { config } = require('@tapps-games/core');
    await config.load('env');
    await config.load('json', 'config.json');

    const { middlewares, routes } = require('@tapps-games/server');

    const express = require('express');
    const bodyParser = require('body-parser');

    const http = require('http');
    const { Server } = require('colyseus');
    const monitor = require('@colyseus/monitor').monitor;

    const BidPvpRoom = require('./bidpvp-room');

    const app = express();

    app.disable('x-powered-by');
    app.enable('trust proxy');

    const gameServer = new Server({
        server: http.createServer(app),
        express: app,
    });

    gameServer.define('bidpvp', BidPvpRoom);

    app.use(bodyParser.json({limit: '10mb'}));

    app.use('/liveness-check', routes.livenessCheck());
    app.use('/readiness-check', routes.readinessCheck());
    app.use('/resource-status', routes.resourceStatus());
    app.use(middlewares.responseTime());

    // register colyseus monitor AFTER registering your room handlers
    app.use('/colyseus', monitor(gameServer));

    app.use(middlewares.notFoundHandler());
    app.use(middlewares.errorHandler());
    app.listen(8080);

    gameServer.listen(COLYSEUS_PORT);
    logger.info(`Listening on ws://localhost:${COLYSEUS_PORT}`);
}

module.exports = {
    createServer,
};
