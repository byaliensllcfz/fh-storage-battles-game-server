'use strict';

const lodash = require('lodash');
const { Logger } = require('@tapps-games/logging');
const { Client } = require('colyseus.js');

const { Config } = require('../../helpers/config-helper');
const { auctionStatus, commands } = require('../../types');

class Bot {

    constructor(botId, serverUrl, city) {
        /** @type {string} */
        this.id = botId;

        /** @type {Client} */
        this.client = new Client(serverUrl);

        /** @type {string} */
        this.character = lodash.sample(Config.game.characters);

        /** @type {string} */
        this.profilePicture = lodash.sample(Config.bot.profilePictures);

        /** @type {string} */
        this.name = lodash.sample(Config.bot.names);

        /** @type {string} */
        this.city = city;

        const moneyModifier = lodash.random(Config.bot.minimumMoneyModifier, Config.bot.maximumMoneyModifier, true);

        /** @type {number} */
        this.startingMoney = lodash.max([city.minimumMoney, lodash.round(moneyModifier * city.maximumMoney)]);

        /** @type {number} */
        this.money = this.startingMoney;
    }

    /**
     * Makes the bot join a given room.
     * @param {string} roomId
     * @return {Promise<void>}
     */
    async joinRoom(roomId) {
        this.logger = new Logger('Bot', { botId: this.id, room: roomId });
        this.logger.info(`Adding bot: ${this.id} to room: ${roomId}`);

        /** @type {Room} */
        this.room = await this.client.joinById(roomId, { bot: true, userId: this.id, character: this.character });

        this.logger.info(`Bot: ${this.id} joined room: ${roomId} with session ID: ${this.room.sessionId}.`);
        this._start();
    }

    /**
     * Disconnect the bot.
     */
    disconnect() {
        this.logger.info(`Bot: ${this.id} disconnecting.`);
        if (this.room && this.room.hasJoined) {
            this.room.leave(true);
        }
    }

    /**
     * Start the bot logic after it has joined the room.
     * @private
     */
    _start() {
        const state = this.room.state;

        state.onChange = (changes) => {
            lodash.forEach(changes, ({field, value}) => {
                if (field === 'status' && value === auctionStatus.PLAY) {
                    this._sendReady();
                }
            });

            if (state.status === auctionStatus.FINISHED || state.status === auctionStatus.REWARDS_SENT) {
                this.disconnect();
            }
        };

        state.lots.onChange = (changes) => {
            lodash.forEach(changes, (value, field) => {
                if (field === 'status') {
                    if (value === auctionStatus.PLAY) {
                        this._setBidTimeout();

                    } else if (value === auctionStatus.FINISHED) {
                        this._sendReady();
                    }
                }
            });
        };

        state.players.onChange = () => {
            this.money = state.players[this.room.sessionId].money;
        };

        this._sendReady();
    }

    _sendReady() {
        const state = this.room.state;

        if (state.status === auctionStatus.PLAY && lodash.keys(state.players).length === Config.game.maxPlayers) {
            this.sendMessage(commands.AUCTION_LOT_READY);
        }
    }

    _setBidTimeout() {
        if (!this.bidTimeout) {
            this.bidTimeout = setTimeout(() => {
                delete this.bidTimeout;
                this._bid();
            }, 1000 * lodash.random(Config.bot.minimumTimeToBidSeconds, Config.bot.maximumTimeToBidSeconds));
        }
    }

    _bid() {
        const auctionState = this.room.state;
        const lotState = auctionState.lots[auctionState.currentLot];

        const auctionItemIds = lodash.map(lotState.items);
        const auctionBoxesIds = lodash.map(lotState.boxes, boxState => boxState.boxId);

        const visibleItemsValue = lodash.sum(lodash.map(auctionItemIds, itemId => Config.getItem(itemId).price));
        const hiddenItemsValue = lodash.sum(lodash.map(auctionBoxesIds, boxId => Config.getBox(boxId).estimatedValue));

        const itemsValue = visibleItemsValue + hiddenItemsValue;
        const modifier = lodash.random(Config.bot.minimumItemValueModifier, Config.bot.maximumItemValueModifier);
        const botItemsValue = modifier * itemsValue;

        const difToThinkAbout = this.city.maximumMoney * Config.bot.idealProfitModifier;

        const bidProbability = lodash.min([Config.bot.bidProbabilityOnProfit, lodash.max([Config.bot.minimumBidProbability, (Config.bot.bidProbabilityOnProfit - 1) + (1 - Config.bot.minimumBidProbability) / difToThinkAbout * (botItemsValue - lotState.bidValue)])]);
        this.logger.info(`BOT generating BID probability. itemsValue: ${itemsValue} (visible: ${visibleItemsValue}; hidden: ${hiddenItemsValue}), mod: ${modifier}, difToThinkAbout: ${difToThinkAbout}. Bid probability: ${bidProbability}.`);

        const randomBidChance = lodash.random(true);
        if (randomBidChance <= bidProbability) {
            if (this.money <= lotState.nextBidValue) {
                this.logger.info(`Bot would bid but has no money. Current money: ${this.money}. Money required to bid: ${lotState.nextBidValue}.`);

            } else {
                this.logger.info(`Bot decided to bid. Bid probability: ${bidProbability}. Random bid chance: ${randomBidChance}.`);
                this.sendMessage(commands.AUCTION_BID);
            }
        } else {
            this.logger.info(`Bot won't bid. Bid probability: ${bidProbability}. Random bid chance: ${randomBidChance}.`);
        }

        if (lotState.status === auctionStatus.PLAY) {
            this._setBidTimeout();
        }
    }

    /**
     * Sends a message to the server.
     * @param {string} command
     * @param {Object} [args]
     */
    sendMessage(command, args) {
        this.room.send({
            command,
            args,
        });
    }
}

module.exports = {
    Bot,
};
