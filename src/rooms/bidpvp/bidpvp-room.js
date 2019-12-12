'use strict';

const lodash = require('lodash');
const uuid = require('uuid/v4');
const { Room } = require('colyseus');
const { Logger } = require('@tapps-games/logging');

const bigQueryHelper = require('../../helpers/big-query-helper');
const { auctionStatus } = require('../../types');
const { Bot } = require('./bot');
const { AuctionState } = require('./schemas/auction-state');
const { PlayerState } = require('./schemas/player-state');
const { AuctionController } = require('./controllers/auction-controller');
const { handleAuctionCommand } = require('./handlers/auction-handler');
const { Config }  = require('../../helpers/config-helper');

class BidPvpRoom extends Room {

    onCreate(options) {
        this.setState(new AuctionState());
        this.setPatchRate(1000 / 20);

        const cityId = options.city;
        /** @type {AuctionController} */
        this.auctionController = new AuctionController(this, cityId);

        /** @type {Object} */
        this.maxClients = Config.game.maxPlayers;

        /** @type {Object<string, Bot>} */
        this.bots = {};

        /** @type {string[]} */
        this.availableBotNames = lodash.cloneDeep(Config.bot.names);

        /** @type {Logger} */
        this.logger = new Logger('BidPvpRoom', { room: this.roomId });

        this.logger.info(`Room Init ${JSON.stringify(options)} - ${this.roomId}`);

        // TODO put this on a config
        this.setSeatReservationTime(5);
    }

    // Firebase token authentication on matchmaking now
    async onAuth(_client, options, _request) {
        if (options.bot) {
            return true;
        }

        return this.auctionController.validatePlayerProfile(options.userId);
    }

    async onJoin(client, options, _auth) {
        this.logger.info(`Client: ${client.id} joined. ${JSON.stringify(options)}`);

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
        this.logger.debug(`Client: ${client.id} sent message ${JSON.stringify(message)}`);

        if (this.locked) {
            handleAuctionCommand(this, client.id, message).catch(error => {
                this.logger.error(`Error handling message: ${JSON.stringify(message)} from player: ${client.id}.`, error);
            });
        }
    }

    async onLeave(client, consented) {
        this.logger.info(`Client: ${client.id} left. Consented: ${consented}`, {
            firebaseId: this.state.players[client.id].firebaseId,
        });

        if (this.state.status === auctionStatus.WAITING) {
            // Player left before match started.
            delete this.state.players[client.id];

        } else if (this.state.status === auctionStatus.PLAY) {
            // Player left during match wait for him to reconnect.
            const playerState = this.state.players[client.id];
            playerState.connected = false;
            playerState.interruptions += 1;

            try {
                await bigQueryHelper.insert({
                    eventName: 'match_interrupted',
                    eventParams: {
                        arena: this.auctionController.city.id,
                        room_id: this.roomId,
                        entry_fee: this.auctionController.city.minimumMoney,
                        interrupted_at_locker: this.state.currentLot,
                        current_cash: playerState.money,
                        consented,
                        interruption_number: playerState.interruptions,
                    },
                    userIds: [playerState.firebaseId],
                });
            } catch (error) {
                this.logger.error('Failed to log match interrupted analytics.', error);
            }

            try {
                if (!consented) {
                    await this.allowReconnection(client, Config.game.allowReconnectionTimeSeconds);

                    // The client has reconnected
                    playerState.connected = true;
                    playerState.reconnections += 1;
                }
            } catch (e) {
                // allowReconnection timer expired.
            }
        }
    }

    async onDispose() {
        this.logger.info('Room disposed');
    }

    _setAddBotTimeout() {
        if (!this.addBotTimeout) {
            this.addBotTimeout = this.clock.setTimeout(this._addBot.bind(this), lodash.random(Config.bot.addBotTimeoutMinimum, Config.bot.addBotTimeoutMaximum));
        }
    }

    /**
     * Instantiates a new bot and adds it to the room.
     * @return {Promise<void>}
     * @private
     */
    async _addBot() {
        delete this.addBotTimeout;

        if (!this.locked) {
            const botName = lodash.sample(this.availableBotNames);
            this.availableBotNames = lodash.filter(this.availableBotNames, name => name !== botName);
            const bot = new Bot(uuid(), botName, 'ws://localhost:2567', this.auctionController.city);

            this.bots[bot.id] = bot;
            await bot.joinRoom(this.roomId);

            this._setAddBotTimeout();
        }
    }

}

module.exports = BidPvpRoom;
