'use strict';

const lodash = require('lodash');
const { Logger } = require('@tapps-games/logging');
const { Client } = require('colyseus.js');

const configHelper = require('../../helpers/config-helper');
const { auctionStatus, commands } = require('../../types');

class Bot {

    constructor(botId, serverUrl, city) {
        const configs = configHelper.get();

        /** @type {string} */
        this.id = botId;

        /** @type {Client} */
        this.client = new Client(serverUrl);

        /** @type {string} */
        this.character = lodash.sample(configs.game.characters);

        /** @type {string} */
        this.profilePicture = lodash.sample(configs.bot.profilePictures);

        /** @type {string} */
        this.name = lodash.sample(configs.bot.names);

        /** @type {string} */
        this.city = city;

        const moneyModifier = lodash.random(configs.bot.minimumMoneyModifier, configs.bot.maximumMoneyModifier, true);

        /** @type {number}*/
        this.money = lodash.max([city.minimumMoney, lodash.round(moneyModifier * city.maximumMoney)]);
    }

    /**
     * Makes the bot join a given room.
     * @param {string} roomId
     * @return {Promise<void>}
     */
    async joinRoom(roomId) {
        this.logger = new Logger('', { botId: this.id, room: roomId });
        this.logger.debug(`Adding bot: ${this.id} to room: ${roomId}`);

        /** @type {Room} */
        this.room = await this.client.joinById(roomId, { bot: true, userId: this.id, character: this.character });

        this.logger.debug(`Bot: ${this.id} joined room: ${roomId} with session ID: ${this.room.sessionId}.`);
        this._start();
    }

    /**
     * Disconnect the bot.
     */
    disconnect() {
        this.logger.debug(`Bot: ${this.id} disconnecting.`);
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
                if (field === 'status' && (value === auctionStatus.FINISHED || value === auctionStatus.REWARDS_SENT)) {
                    this.disconnect();
                }
            });
        };

        state.lots.onChange = (changes) => {
            lodash.forEach(changes, (value, field) => {
                if (field === 'status' && value === auctionStatus.PLAY) {
                    this._setBidTimeout();
                }
            });
        };

        state.players.onChange = (changes) => {
            lodash.forEach(changes, (_value, field) => {
                if (field === 'money') {
                    this.money = state.players[this.room.sessionId].money;
                }
            });
        };
    }

    _setBidTimeout() {
        if (!this.bidTimeout) {
            const configs = configHelper.get();

            this.bidTimeout = setTimeout(() => {
                delete this.bidTimeout;
                this._bid();
            }, 1000 * lodash.random(configs.bot.minimumTimeToBidSeconds, configs.bot.maximumTimeToBidSeconds));
        }
    }

    _bid() {
        const configs = configHelper.get();

        const auctionState = this.room.state;
        const lotState = auctionState.lots[auctionState.currentLot];

        const auctionItemIds = lodash.map(lotState.items);
        const visibleItemsValue = lodash.sum(lodash.map(auctionItemIds, itemId => configs.items[itemId].price));
        const hiddenItemsValue = lodash.size(lotState.boxes) * configs.bot.averageBoxValue;

        const itemsValue = visibleItemsValue + hiddenItemsValue;
        const modifier = lodash.random(configs.bot.minimumItemValueModifier, configs.bot.maximumItemValueModifier);
        const botItemsValue = modifier * itemsValue;

        const difToThinkAbout = this.city.maximumMoney * configs.bot.idealProfitModifier;

        const bidProbability = lodash.min([configs.bot.bidProbabilityOnProfit, lodash.max([configs.bot.minimumBidProbability, (configs.bot.bidProbabilityOnProfit - 1) + (1 - configs.bot.minimumBidProbability) / difToThinkAbout * (botItemsValue - lotState.bidValue)])]);
        this.logger.debug(`BOT generating BID probability. itemsValue: ${itemsValue} (visible: ${visibleItemsValue}; hidden: ${hiddenItemsValue}), mod: ${modifier}, difToThinkAbout: ${difToThinkAbout}. Bid probability: ${bidProbability}.`);

        const randomBidChance = lodash.random(true);
        if (randomBidChance <= bidProbability) {
            const moneyRequiredToBid = lotState.bidValue + configs.game.bidIncrement;
            if (this.money >= moneyRequiredToBid) {
                this.logger.debug(`Bot would bid but has no money. Current money: ${this.money}. Money required to bid: ${moneyRequiredToBid}.`);

            } else {
                this.logger.debug(`Bot decided to bid. Bid probability: ${bidProbability}. Random bid chance: ${randomBidChance}.`);
                this.sendMessage(commands.AUCTION_BID);
            }
        } else {
            this.logger.debug(`Bot won't bid. Bid probability: ${bidProbability}. Random bid chance: ${randomBidChance}.`);
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
