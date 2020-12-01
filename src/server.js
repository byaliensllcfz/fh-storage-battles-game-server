'use strict';

const COLYSEUS_PORT = 2567;

const { Logger } = require('@tapps-games/logging');
const { Retry } = require('@tapps-games/core');
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
const agonesHelper = require('./helpers/agones-helper');

const { LocalDriver } = require('colyseus/lib/matchmaker/drivers/LocalDriver');

const logger = new Logger('Server');

/**
 * @return {Promise<void>}
 */
async function createServer() {
    const app = express();

    await agonesHelper.connectToAgones();

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

    agonesHelper.setUpHealthCheck(app, utils);

    app.use('/readiness-check', routes.readinessCheck());
    app.use('/resource-status', routes.resourceStatus());
    app.use(middlewares.responseTime());

    //gets all DB configs and cache it
    await _loadConfig();

    // register colyseus monitor AFTER registering your room handlers
    app.use('/colyseus', monitor(gameServer));

    app.get('/configs/reload', utils.asyncRoute(async (_req, res) => {
        await _loadConfig();
        res.send('configs reloaded');
    }));

    app.get('/rooms', utils.asyncRoute(async (_req, res) => {
        const rooms = await matchMaker.query({});
        const data = {
            rooms: rooms.length,
        };

        res.contentType('application/json');
        res.send(JSON.stringify(data));
    }));

    agonesHelper.setUpDeallocateEndpoint(app, utils);

    app.post('/reserve', utils.asyncRoute(async (req, res) => {
        let reservation;

        const abFlag = req.headers['abtestgroup'];

        const options = {
            userId: req.body.userId,
            character: req.body.character,
            city: req.body.cityId,
            abtestgroup: abFlag,
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

    gameServer.listen(COLYSEUS_PORT);
    logger.info(`Listening on ws://localhost:${COLYSEUS_PORT}`);

    await agonesHelper.sendAgonesReady();
}

/**
 * @return {Promise<void>}
 * @private
 */
async function _loadConfig() {
    const retry = new Retry({retries: 10});
    await retry.attempt(async () => {
        const configs = await configDao.getConfigs();
        Config.set(configs);
    });
}

module.exports = {
    createServer,
};
