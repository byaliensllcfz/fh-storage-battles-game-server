'use strict';

const COLYSEUS_PORT = 2567;

const { config } = require('@tapps-games/core');
const { Logger } = require('@tapps-games/logging');

const { middlewares, routes } = require('@tapps-games/server');

const express = require('express');
const bodyParser = require('body-parser');

const http = require('http');
const { Server } = require('colyseus');
const monitor = require('@colyseus/monitor').monitor;

const BidPvpRoom = require('./rooms/bidpvp/bidpvp-room');
const LobbyRoom = require('./rooms/lobby/lobby-room');

const configDao = require('./daos/config-dao');
const configHelper = require('./helpers/config-helper');

const logger = new Logger();


async function createServer () {
    await config.load('env');
    await config.load('json', 'config.json');

    const app = express();

    app.disable('x-powered-by');
    app.enable('trust proxy');

    const gameServer = new Server({
        server: http.createServer(app),
        express: app,
    });

    gameServer.define('bidpvp', BidPvpRoom);
    gameServer.define('lobby', LobbyRoom);

    app.use(bodyParser.json({limit: '10mb'}));

    app.use('/liveness-check', routes.livenessCheck());
    app.use('/readiness-check', routes.readinessCheck());
    app.use('/resource-status', routes.resourceStatus());
    app.use(middlewares.responseTime());

    //gets all DB configs and cache it
    await _loadConfig();

    // register colyseus monitor AFTER registering your room handlers
    app.use('/colyseus', monitor(gameServer));

    app.use(middlewares.notFoundHandler());
    app.use(middlewares.errorHandler());
    app.listen(8081);

    gameServer.listen(COLYSEUS_PORT);
    logger.info(`Listening on ws://localhost:${COLYSEUS_PORT}`);
}

async function _loadConfig() {
    const configs = await configDao.getConfigs();
    configHelper.set(configs);
}

module.exports = {
    createServer,
};
