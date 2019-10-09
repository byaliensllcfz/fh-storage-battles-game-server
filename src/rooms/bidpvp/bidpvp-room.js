'use strict';

const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

const { Room } = require('colyseus');
const { GlobalState } = require('./schemas/global-state');

class BidPvpRoom extends Room {
    onCreate (options) {
        logger.info(`Room Init ${JSON.stringify(options)} - ${this.roomId}`, { room: this.roomId });

        this.setState(new GlobalState());
        this.setPatchRate(1000 / 20);

        /** @type {number} */
        this.maxClients = 2;
    }

    onJoin (client, options) {
        logger.info(`Client: ${client} joined. ${JSON.stringify(options)}`, { room: this.roomId });

    }

    onMessage (client, message) {
        logger.info(`Client: ${client.id} sent message ${JSON.stringify(message)}`, { room: this.roomId });
    }

    async onLeave (client, consented) {
        logger.info(`Client: ${client} left. consented? ${consented}`, { room: this.roomId });

        try {
            if (consented) {
                throw new Error('consented leave');
            }
            // allow disconnected client to reconnect into this room until 20 seconds
            await this.allowReconnection(client, 20);

            // client returned! let's re-activate it.
            //this.state.players[client.sessionId].connected = true;
        }
        catch (e) {
            // 20 seconds expired. let's remove the client.
            //delete this.state.players[client.sessionId];
        }
    }

    onDispose () {

    }
}

module.exports = BidPvpRoom;