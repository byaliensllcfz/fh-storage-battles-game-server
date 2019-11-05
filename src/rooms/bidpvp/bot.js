'use strict';

const lodash = require('lodash');
const { Logger } = require('@tapps-games/logging');
const { Client } = require('colyseus.js');

const configHelper = require('../../helpers/config-helper');
const { auctionStatus, commands } = require('../../types');

class Bot {

    constructor(botId, serverUrl, cityId) {
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
        this.cityId = cityId;

        const cityConfig = lodash.find(configs.cities, city => city.id === cityId);
        const moneyModifier = lodash.random(configs.bot.minimumMoneyModifier, configs.bot.maximumMoneyModifier);

        /** @type {number}*/ // TODO: Decrement bot money if he wins the lot
        this.money = lodash.max([cityConfig.minimumMoney, lodash.round(moneyModifier * cityConfig.maximumMoney)]);
    }

    /**
     * Makes the bot join a given room.
     * @param {string} roomId
     * @return {Promise<void>}
     */
    async joinRoom(roomId) {
        this.logger = new Logger('', { botId: this.id, room: roomId });
        this.logger.info(`Adding bot: ${this.id} to room: ${roomId}`);

        /** @type {Room} */
        this.room = await this.client.join(roomId, { bot: true, userId: this.id, character: this.character });

        return new Promise(resolve => {
            this.room.onJoin.add(() => {
                this.logger.info(`Bot: ${this.id} joined room: ${roomId} with client ID: ${this.client.id}.`);
                this._start();
                resolve();
            });
        });
    }

    /**
     * Leave the room.
     * @private
     */
    _leave() {
        if (this.room && this.room.hasJoined) {
            this.room.leave(true);
        }
    }

    /**
     * Disconnect the bot.
     */
    disconnect() {
        this.logger.info(`Bot: ${this.id} disconnecting.`);
        this._leave();

        if (this.client) {
            this.client.close();
        }
    }

    /**
     * Start the bot logic after it has joined the room.
     * @private
     */
    _start() {
        const state = this.room.state;

        state.onChange = (changes) => {
            changes.forEach(({field, value}) => {
                if (field === 'status') {
                    switch (value) {
                        case auctionStatus.PLAY:
                            state.lots.onChange = this._handleLotStateChanges.bind(this);
                            break;

                        case auctionStatus.FINISHED:
                            this.disconnect();
                            break;
                    }
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

    /**
     * Listen to lot state changes and act accordingly.
     * @param lotsChanges
     * @private
     */
    _handleLotStateChanges(lotsChanges) {
        lodash.forEach(lotsChanges, ({ field, value }) => {
            if (field === 'status' && value === auctionStatus.PLAY) {
                this._setBidTimeout();
            }
        });
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

        const cityConfig = lodash.find(configs.cities, city => city.id === this.cityId);
        const difToThinkAbout = cityConfig.maximumMoney * configs.bot.idealProfitModifier;

        const bidProbability = lodash.min([configs.bot.bidProbabilityOnProfit, lodash.max([configs.bot.minimumBidProbability, (configs.bot.bidProbabilityOnProfit - 1) + (1 - configs.bot.minimumBidProbability) / difToThinkAbout * (botItemsValue - lotState.bidValue)])]);
        this.logger.info(`BOT generating BID. itemsValue: ${itemsValue} (visible: ${visibleItemsValue}; hidden: ${hiddenItemsValue}), mod: ${modifier}, difToThinkAbout: ${difToThinkAbout}. Bid probability: ${bidProbability}.`);

        if (lodash.random(true) <= bidProbability && this.money >= lotState.bidValue + configs.game.bidIncrement) {
            this.sendMessage(commands.AUCTION_BID);
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
            commandIndex: 0,
        });
    }
}

module.exports = {
    Bot,
};
