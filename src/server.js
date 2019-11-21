'use strict';

const COLYSEUS_PORT = 2567;

const { Logger } = require('@tapps-games/logging');
const { middlewares, routes, utils } = require('@tapps-games/server');

const express = require('express');
const bodyParser = require('body-parser');

const http = require('http');
const { Server, matchMaker } = require('colyseus');
const monitor = require('@colyseus/monitor').monitor;

const BidPvpRoom = require('./rooms/bidpvp/bidpvp-room');
const LobbyRoom = require('./rooms/lobby/lobby-room');

const configDao = require('./daos/config-dao');
const { Config } = require('./helpers/config-helper');

const { LocalDriver } = require('colyseus/lib/matchmaker/drivers/LocalDriver');

const logger = new Logger();

async function createServer() {
    const app = express();

    app.disable('x-powered-by');
    app.enable('trust proxy');

    const driver = new LocalDriver();

    const gameServer = new Server({
        driver: driver,
        server: http.createServer(app),
        express: app,
    });

    gameServer.define('bidpvp', BidPvpRoom).filterBy(['city']);
    gameServer.define('lobby', LobbyRoom);

    app.use(bodyParser.json({ limit: '10mb' }));

    app.use('/liveness-check', routes.livenessCheck());
    app.use('/readiness-check', routes.readinessCheck());
    app.use('/resource-status', routes.resourceStatus());
    app.use(middlewares.responseTime());

    //gets all DB configs and cache it
    await _loadConfig();

    //app.use(middlewares.validateSharedCloudSecret());

    // register colyseus monitor AFTER registering your room handlers
    app.use('/colyseus', monitor(gameServer));

    app.get('/configs/reload', utils.asyncRoute(async (_req, res) => {
        await _loadConfig();
        res.send('configs reloaded');
    }));

    app.post('/reserve', utils.asyncRoute(async (req, res) => {
        let reservation;

        const options = {
            userId: req.body.userId,
            character: req.body.character,
            city: req.body.cityId,
        };

        try {
            reservation = await matchMaker.join('bidpvp', options);
        }
        catch (e) {
            reservation = await matchMaker.create('bidpvp', options);
        }

        res.send(reservation);
    }));

    app.use(middlewares.notFoundHandler());
    app.use(middlewares.errorHandler());
    app.listen(8081);

    gameServer.listen(COLYSEUS_PORT);
    logger.info(`Listening on ws://localhost:${COLYSEUS_PORT}`);
}

async function _loadConfig() {
    const configs = await configDao.getConfigs();
    Config.set(configs);
}

module.exports = {
    createServer,
};
