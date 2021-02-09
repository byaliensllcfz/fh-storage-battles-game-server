'use strict';

const lodash = require('lodash');
const { Logger } = require('@tapps-games/logging');
const { Client } = require('colyseus.js');
const { EventEmitter } = require('events');

const { Config } = require('../../helpers/config-helper');
const itemStateHelper = require('../../helpers/item-state-helper');

const { auctionStatus, commands, botEvents } = require('../../types');

class Bot {

    constructor(botId, botName, serverUrl, city) {
        /** @type {string} */
        this.id = botId;

        /** @type {Client} */
        this.client = new Client(serverUrl);

        /** @type {string} */
        this.character = lodash.sample(Config.game.characters);

        /** @type {string} */
        this.profilePicture = lodash.sample(Config.bot.profilePictures);

        /** @type {string} */
        this.name = botName;

        /** @type {CityConfig} */
        this.city = city;

        //TODO deprecate this properties
        const moneyModifier = lodash.random(Config.bot.minimumMoneyModifier, Config.bot.maximumMoneyModifier, true);

        /** @type {number} */
        this.startingMoney = lodash.max([city.minimumMoney, lodash.round(moneyModifier * city.maximumMoney)]);

        /** @type {number} */
        this.money = this.startingMoney;

        /** @type {number} */
        this.trophies = 0;

        /** @type {number} */
        this.rank = 1;

        /** @type {boolean} */
        this.hadBid = false;

        /** @type {EventEmitter} */
        this.eventEmitter = new EventEmitter();

        this._generateRankAndTrophies();
    }

    _generateRankAndTrophies() {
        const milestonesOrdered = lodash.sortBy(Config.milestonesV2, milestone => milestone.trophies);

        if (this.city.isEvent) {
            this.trophies = 0;
        }
        else {
            for (let i=0; i< milestonesOrdered.length; i++) {
                const cityReward = lodash.filter(milestonesOrdered[i].rewards, reward => reward.rewardType === 'city' && reward.rewardId === this.city.id);
                if (!lodash.isEmpty(cityReward)) {
                    const initTrophies = milestonesOrdered[i].trophies;
                    this.rank = milestonesOrdered[i].rank;

                    if (milestonesOrdered[i+1]) {
                        this.trophies = lodash.random(initTrophies, milestonesOrdered[i+1].trophies);
                    }
                    else {
                        this.trophies = lodash.random(initTrophies, initTrophies*2);
                    }
                }
            }
        }
    }

    /**
     * Makes the bot join a given room.
     * @param {string} roomId
     * @return {Promise<void>}
     */
    async joinRoom(roomId) {
        this.logger = new Logger('Bot', { botId: this.id, room: roomId });
        this.logger.info(`Adding bot: ${this.id} to room: ${roomId}`, {
            name: this.name,
            character: this.character,
            profilePicture: this.profilePicture,
            startingMoney: this.startingMoney,
            trophies: this.trophies,
            rank: this.rank,
        });

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

        if (this.bidTimeout) {
            clearTimeout(this.bidTimeout);
        }

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
        this.clientId = this.room.sessionId;

        this.room.onMessage((messageString) => {
            const message = JSON.parse(messageString);
            if (message.emoji && message.client != this.clientId) {
                this._tryTriggerEmoji('reaction', message.emoji);
            } else if (message.bidStatus) {
                this.eventEmitter.emit(botEvents.BID_PROCESSED, { botId: this.id });
            }
        });

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
                        this._setBidTimeout(state.currentLot);

                    } else if (value === auctionStatus.FINISHED) {
                        this._sendReady();
                    }
                }
                else if (field === 'bidOwner') {
                    if (value === this.clientId) {
                        this._tryTriggerEmoji('bidded');
                        this.hadBid = true;
                    }
                    else if (this.hadBid) {
                        this._tryTriggerEmoji('outbidded');
                        this.hadBid = false;
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

    _setBidTimeout(lot) {
        if (!this.bidTimeout) {
            this.bidTimeout = setTimeout(() => {
                delete this.bidTimeout;
                this._bid(lot);
            }, 1000 * lodash.random(Config.bot.minimumTimeToBidSeconds, Config.bot.maximumTimeToBidSeconds));
        }
    }

    _bid(lot) {
        const auctionState = this.room.state;
        const lotState = auctionState.lots[auctionState.currentLot];

        // Dont try to bid if its not the same active lot or lot FINISHED
        if ( (lotState.status === auctionStatus.FINISHED) || (auctionState.currentLot != lot) ){
            return;
        }

        const auctionBoxesIds = lodash.map(lotState.boxes, boxState => boxState.boxId);

        const visibleItemsValue = lodash.sum(lodash.map(lotState.items, lotItem => {
            const item = Config.getItem(lotItem.itemId);
            return itemStateHelper.getItemPrice(Config, item.price, lotItem.state);
        }));

        const hiddenItemsValue = auctionBoxesIds.length * this.city.estimatedBoxValue;

        const itemsValue = visibleItemsValue + hiddenItemsValue;
        const modifier = lodash.random(Config.bot.minimumItemValueModifier, Config.bot.maximumItemValueModifier);
        const botItemsValue = modifier * itemsValue;

        const difToThinkAbout = this.city.maximumMoney * Config.bot.idealProfitModifier;

        const bidProbability = lodash.min([Config.bot.bidProbabilityOnProfit, lodash.max([Config.bot.minimumBidProbability, (Config.bot.bidProbabilityOnProfit - 1) + (1 - Config.bot.minimumBidProbability) / difToThinkAbout * (botItemsValue - lotState.bidValue)])]);
        this.logger.debug(`BOT generating BID probability. itemsValue: ${itemsValue} (visible: ${visibleItemsValue}; hidden: ${hiddenItemsValue}), mod: ${modifier}, difToThinkAbout: ${difToThinkAbout}, botItemsValue: ${botItemsValue}, bidValue: ${lotState.bidValue}. Bid probability: ${bidProbability}.`);

        const randomBidChance = lodash.random(true);
        if (randomBidChance <= bidProbability) {
            if (this.money <= lotState.nextBidValue) {
                this.logger.debug(`Bot would bid but has no money. Current money: ${this.money}. Money required to bid: ${lotState.nextBidValue}.`);

            } else {
                this.logger.debug(`Bot decided to bid on lot ${auctionState.currentLot}. Bid probability: ${bidProbability}. Random bid chance: ${randomBidChance}.`);
                this.sendMessage(commands.AUCTION_BID);
                this.eventEmitter.emit(botEvents.BID_PERFORMED, { botId: this.id });
            }
        } else {
            this.logger.debug(`Bot won't bid on lot ${auctionState.currentLot}. Bid probability: ${bidProbability}. Random bid chance: ${randomBidChance}.`);
        }

        if (lotState.status === auctionStatus.PLAY) {
            this._setBidTimeout(lot);
        }
    }

    _tryTriggerEmoji(trigger, emoji) {
        if (Config.bot.emojiTriggers && Config.emojis) {
            const triggerFound = lodash.find(Config.bot.emojiTriggers, configTrigger => configTrigger.trigger === trigger);
            let triggered = true;
            if (triggerFound) {
                if (triggerFound.trigger === 'reaction' && !lodash.includes(triggerFound.extraTrigger, emoji)) {
                    triggered = false;
                }

                if (triggered && lodash.random(0.0, 1.0, true) <= triggerFound.probability) {
                    const emojiResponse = lodash.sample(triggerFound.emojis);
                    if (!Config.emojis[emojiResponse]) {
                        this.logger.error(`Emoji ${emojiResponse} used on bot config does not exist`);
                        return;
                    }
                    this.logger.debug(`Bot triggered by ${triggerFound.trigger} (${emoji}) sent an EMOJI ${emojiResponse}`);
                    this._sendEmojiAfterTime(emojiResponse);
                }
            }
        }
    }

    _sendEmojiAfterTime(emoji) {
        if (this.emojiTimeout) {
            clearTimeout(this.emojiTimeout);
        }

        this.emojiTimeout = setTimeout(() => {
            delete this.emojiTimeout;
            this.sendMessage(commands.EMOJI, {emoji: emoji});
        }, lodash.random(Config.bot.minEmojiReactionTimerMs, Config.bot.maxEmojiReactionTimerMs));
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

    /**
     * Add a listener to an event
     * @param {string} eventName
     * @param {Function} callback
     */
    addListener(eventName, callback) {
        this.eventEmitter.addListener(eventName, callback);
    }

    /**
     * Remove a listener to an event
     * @param {string} eventName
     * @param {Function} callback
     */
    removeListener(eventName, callback) {
        this.eventEmitter.removeListener(eventName, callback);
    }

    /**
     * Remove all listeners
     * @param {string} [eventName]
     */
    removeAllListeners(eventName) {
        this.eventEmitter.removeAllListeners(eventName);
    }
}

module.exports = {
    Bot,
};
