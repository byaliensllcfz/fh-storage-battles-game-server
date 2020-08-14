'use strict';

const lodash = require('lodash');
const { Logger } = require('@tapps-games/logging');

const { Room } = require('colyseus');
const { LobbyState } = require('./schemas/lobby-state');
const { Config } = require('../../helpers/config-helper');

class LobbyRoom extends Room {
    onCreate(options) {

        this.setState(new LobbyState());
        this.setPatchRate(1000 / 20);

        /** @type {Logger} */
        this.logger = new Logger('LobbyRoom', { room: this.roomId });

        this.logger.debug(`Room Init ${JSON.stringify(options)} - ${this.roomId}`);
    }

    onJoin(client, options) {
        this.logger.debug(`Client: ${client.id} joined. ${JSON.stringify(options)}`);

        this.sendConfig(client);
    }

    onMessage(client, message) {
        this.logger.debug(`Client: ${client.id} sent message ${JSON.stringify(message)}`);
    }

    onLeave(client, consented) {
        this.logger.info(`Client: ${client.id} left. consented? ${consented}`);
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
