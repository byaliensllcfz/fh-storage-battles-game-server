'use strict';

const lodash = require('lodash');
const { Logger } = require('@tapps-games/logging');

const { Room } = require('colyseus');
const { LobbyState } = require('./schemas/lobby-state');
const { Config } = require('../../helpers/config-helper');

const logger = new Logger();

class LobbyRoom extends Room {
    onCreate(options) {
        logger.info(`Room Init ${JSON.stringify(options)} - ${this.roomId}`, { room: this.roomId });

        this.setState(new LobbyState());
        this.setPatchRate(1000 / 20);
    }

    onJoin(client, options) {
        logger.info(`Client: ${client} joined. ${JSON.stringify(options)}`, { room: this.roomId });

        this.sendConfig(client);
    }

    onMessage(client, message) {
        logger.info(`Client: ${client.id} sent message ${JSON.stringify(message)}`, { room: this.roomId });
    }

    onLeave(client, consented) {
        logger.info(`Client: ${client} left. consented? ${consented}`, { room: this.roomId });
    }

    onDispose() {

    }

    sendConfig(client) {
        const startingConfig = {
            roomId: this.roomId,
            items: lodash.map(Config.items),
        };

        this.send(client, JSON.stringify(startingConfig));
    }
}

module.exports = LobbyRoom;
