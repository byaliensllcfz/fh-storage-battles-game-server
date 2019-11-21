'use strict';

const lodash = require('lodash');
const uuid = require('uuid/v4');
const { Room } = require('colyseus');
const { Logger } = require('@tapps-games/logging');

const { Bot } = require('./bot');
const { AuctionState } = require('./schemas/auction-state');
const { PlayerState } = require('./schemas/player-state');
const { AuctionController } = require('./controllers/auction-controller');
const { handleAuctionCommand } = require('./handlers/auction-handler');
const { Config }  = require('../../helpers/config-helper');

const logger = new Logger();

class BidPvpRoom extends Room {

    onCreate(options) {
        logger.info(`Room Init ${JSON.stringify(options)} - ${this.roomId}`, { room: this.roomId });

        this.setState(new AuctionState());
        this.setPatchRate(1000 / 20);

        const cityId = options.city;
        this.auctionController = new AuctionController(this, cityId);

        /** @type {Object} */
        this.maxClients = Config.game.maxPlayers;

        /** @type {Object<string, Bot>} */
        this.bots = {};

        // TODO put this ona  config
        this.setSeatReservationTime(5);
    }

    // Authentication on matchmaking now
    async onAuth(_client, _options) {
        return true;
    }

    async onJoin(client, options) {
        logger.info(`Client: ${client.id} joined. ${JSON.stringify(options)}`, { room: this.roomId });

        this.state.players[client.id] = new PlayerState({
            id: client.id,
            firebaseId: options.userId,
            character: options.character,
            isBot: options.bot,
        });

        if (this.locked) {
            await this.lock(); // Prevent new players from joining if any players leave.

            await this.auctionController.startAuction();

        } else {
            this._setAddBotTimeout();
        }
    }

    onMessage(client, message) {
        logger.info(`Client: ${client.id} sent message ${JSON.stringify(message)}`, { room: this.roomId });

        if (this.locked) {
            handleAuctionCommand(this, client.id, message).catch(error => {
                logger.error(`Error handling message: ${message} from player: ${client.id}.`, error);
            });
        }
    }

    async onLeave(client, consented) {
        logger.info(`Client: ${client.id} left. Consented: ${consented}`, { room: this.roomId });
        this.state.players[client.id].connected = false;

        try {
            if (!consented) {
                await this.allowReconnection(client, Config.game.allowReconnectionTimeSeconds);

                // The client has reconnected
                this.state.players[client.id].connected = true;
            }
        }
        catch (e) {
            // allowReconnection timer expired.
        }
    }

    onDispose() {
        logger.info('Room disposed', { room: this.roomId });
    }

    _setAddBotTimeout() {
        if (!this.addBotTimeout) {
            this.addBotTimeout = this.clock.setTimeout(this._addBot.bind(this), lodash.random(Config.bot.addBotTimeoutMinimum, Config.bot.addBotTimeoutMaximum));
        }
    }

    /**
     * Instantiates a new bot and adds it to the room.
     */
    async _addBot() {
        delete this.addBotTimeout;

        if (!this.locked) {
            const bot = new Bot(uuid(), 'ws://localhost:2567', this.auctionController.city);
            this.bots[bot.id] = bot;

            await bot.joinRoom(this.roomId);

            this._setAddBotTimeout();
        }
    }

}

module.exports = BidPvpRoom;
