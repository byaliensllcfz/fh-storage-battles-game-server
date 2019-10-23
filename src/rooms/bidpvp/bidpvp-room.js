'use strict';

const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

const { Room } = require('colyseus');
const { GlobalState } = require('./schemas/global-state');
const { PlayerState } = require('./schemas/player-state');
const { AuctionController } = require('./controllers/auction-controller');
const { auctionHandler } = require('./handlers/auction-handler');

const configHelper = require('../../helpers/config-helper');
const { commands } = require('../../types');

class BidPvpRoom extends Room {
    onCreate (options) {
        logger.info(`Room Init ${JSON.stringify(options)} - ${this.roomId}`, { room: this.roomId });

        this.setState(new GlobalState());
        this.setPatchRate(1000 / 20);

        this.auctionController = new AuctionController(this);

        /** @type {number} */
        const configs = configHelper.get();
        this.maxClients = configs.game.maxPlayers;
    }

    onJoin (client, options) {
        logger.info(`Client: ${client.id} joined. ${JSON.stringify(options)}`, { room: this.roomId });

        this.state.players[client.id] = new PlayerState({ id: client.id });

        if (this.locked) {
            auctionHandler(this, null, { command: commands.AUCTION_START });
        }
    }

    onMessage (client, message) {
        logger.info(`Client: ${client.id} sent message ${JSON.stringify(message)}`, { room: this.roomId });

        if(this.locked) {
            auctionHandler(this, client.id, message);
        }
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