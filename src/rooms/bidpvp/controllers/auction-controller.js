'use strict';

const lodash = require('lodash');
const weighted = require('weighted');
const { MapSchema } = require('@colyseus/schema');
const { Logger } = require('@tapps-games/logging');

const bigQueryHelper = require('../../../helpers/big-query-helper');
const itemStateHelper = require('../../../helpers/item-state-helper');

const profileDao = require('../../../daos/profile-dao');
const rewardDao = require('../../../daos/reward-dao');
const { auctionStatus } = require('../../../types');
const { BidInterval } = require('../../../helpers/bid-interval');
const { Config } = require('../../../helpers/config-helper');
const { LotState } = require('../schemas/lot-state');
const { BoxState } = require('../schemas/box-state');
const { ItemState } = require('../schemas/item-state');
const { EffectState } = require('../schemas/effect-state');
const { PowerState } = require('../schemas/power-state');

class AuctionController {

    /**
     * @param {BidPvpRoom} room
     * @param {string} cityId
     */
    constructor(room, cityId) {
        this.room = room;
        this.state = room.state;
        this.state.randomSeed = lodash.random(-100000, 100000);
        this.lotEndTimeout = null;
        this.lotStartTimeout = null;
        this.bidInterval = null;
        this.bidIntervalTimeout = null;
        this._started = false;
        this.playersLotReady = {};
        this.profiles = {};
        this.lastSentEmoji = {};
        this.gameStartedAtDateTime = Date.now();
        this.expirePowerEffectTimeout = null;

        /** @type {number} */
        this.lotsAmount = Config.game.lotsAmount;

        /** @type {CityConfig} */
        this.city = Config.cities[cityId];

        this.logger = new Logger('AuctionController', { room: this.room.roomId });

        this.bidStep = 0;
        this._generateLots(this.lotsAmount);
    }

    /**
     * @return {Promise<void>}
     */
    async startAuction() {
        this.logger.info(`Attempting to start auction on ${this.city.id} - (event? ${this.city.isEvent})`);
        if (this._started) {
            return;
        }

        this.logger.info('Auction started - GAME ON');
        this._started = true;

        lodash.each(this.state.players, player => {
            if (player.isBot) {
                const bot = this.room.bots[player.firebaseId];
                const maxMoney = this._getInitialMaxMoney(player, {}, bot.character);

                player.name = bot.name;
                player.photoUrl = bot.profilePicture;
                player.money = maxMoney;
                player.trophies = bot.trophies;
                player.rank = bot.rank;
            }
            else {
                const playerData = this.profiles[player.firebaseId];
                const maxMoney = this._getInitialMaxMoney(player, playerData, playerData.character.id);

                player.name = playerData.profile.alias;
                player.photoUrl = playerData.profile.picture;
                player.money = lodash.min([playerData.currencies.softCurrency, maxMoney]);
                player.trophies = playerData.currencies.trophies;
                player.rank = playerData.currencies.rank;
                player.character = playerData.character.id;
            }
        });

        this.state.status = auctionStatus.PLAY;
        this.state.currentLot = 0;
        this.lotStartTimeout = this.room.clock.setTimeout(() => this._startInspect(true), Config.game.forceLotStartTimeout);
    }

    // called on bidpvp-room.onAuth so if anything is wrong with the player, returns false and log
    async validatePlayerProfile(userId) {
        const profiles = await profileDao.getProfiles([userId]);
        const profile = profiles[userId];

        if (profile && profile.profile && profile.currencies && profile.character) {
            this.profiles[userId] = profile;

            const characterConfig = Config.getCharacter(profile.character.id);
            if (lodash.isUndefined(characterConfig)) {
                this.logger.error(`Character ${profile.character.id} used by ${userId} not found.`, {
                    firebaseId: userId,
                });
                return false;
            }

            return true;

        } else {
            this.logger.error(`User ${userId} attempted to join but his profile is incomplete. profile=${JSON.stringify(profile)}.`, {
                firebaseId: userId,
            });

            return false;
        }
    }

    _getInitialMaxMoney(player, profile, characterId) {
        const characterConfig = Config.getCharacter(characterId);
        let maxMoney = this.city.maximumMoney;

        // Character can have more than one skill.
        lodash.each(characterConfig.skills, skillId => {
            const skillConfig = Config.getSkill(skillId);
            if (!skillConfig) {
                this.logger.error(`Cannot apply skill to user=${player.id} bot:(${player.isBot}). Skill config ${skillId} not found.`, {
                    firebaseId: player.firebaseId,
                });
                return;
            }

            // Execute skill highlight odds.
            if (skillConfig.type === 'pimpmybid') {
                const skillProbability = this._findSkillProbability(player, profile, skillConfig);
                maxMoney = parseInt( (maxMoney + (maxMoney * skillProbability) ).toFixed(0));
            }
        });

        return maxMoney;
    }

    _getPlayerProfile(player) {
        return this.profiles[player.firebaseId];
    }

    /**
     * Calculates the next bid value and updates the state.
     * @param {number} currentBid
     */
    _setNextBidValue(currentBid) {
        this.bidStep++;
        const stepIncrement = Math.ceil(this.bidStep / this.city.bidRepeatValue);
        const bidIncrement = stepIncrement * this.city.minBidIncrement;

        this._getCurrentLot().nextBidValue = Math.round(bidIncrement + currentBid);

        this.logger.debug(`InitialBid: ${this._getCurrentLot().initialBid}, CurrentBid: ${currentBid}, stepIncrement: ${stepIncrement}, bidIncrement: ${bidIncrement}, newBidValue: ${this._getCurrentLot().nextBidValue}`);
    }

    /**
     * @return {string}
     */
    getCurrentLotStatus() {
        return this._getCurrentLot().status;
    }

    /**
     * @param {number} lotAmount
     * @private
     */
    _generateLots(lotAmount) {
        for (let index = 0; index < lotAmount; index++) {
            let newLot = new LotState();
            this.state.lots.push(newLot);

            this._generateLotItems(index, newLot);
        }

        if (this.city.isEvent) {
            this._generateLotsEventItems(lotAmount);
        }

        lodash.forEach(this.state.lots, (lot, idx) => this._generateInitialBid(lot, idx));
    }

    _generateLotsEventItems(lotAmount) {
        const shuffledLots = lodash.shuffle(Array.from(Array(lotAmount).keys()));
        const probabilityPerRarity = lodash.keyBy(this.city.eventItemsRarity, prob => prob.rarity);

        let eventItemsDrawn = 0;
        for (let index = 0; index < lotAmount; index++) {
            const lot = this.state.lots[shuffledLots[index]];
            let lotItemsAmount = lodash.keys(lot.items).length;

            const eventItemsPerRarity = lodash.clone(this.city.eventItemsPerRarity);
            //only once per rarity, per lot
            lodash.each(this.city.eventItemRarities, rarity => {
                if (!lodash.isEmpty(eventItemsPerRarity[rarity])) {
                    const probability = probabilityPerRarity[rarity].drawProbability;

                    const options = [true, false];
                    const weights = [probability, 1 - probability];
                    if (weighted.select(options, weights)) {
                        const itemId = lodash.sample(eventItemsPerRarity[rarity]);
                        const state = this._pickItemState();
                        this.logger.debug(`Drawing EVENT item ${itemId}, from rarity ${rarity} on lot ${shuffledLots[index]}`);

                        lot.items[lotItemsAmount] = new ItemState(itemId, state);

                        //remove item already drawn
                        lodash.remove(eventItemsPerRarity[rarity], itemId);
                        eventItemsDrawn++;
                        lotItemsAmount++;
                    }
                }
            });

            //if no event item drawn, select one at random
            if (eventItemsDrawn === 0 && index === (lotAmount-1)) {
                const itemId = lodash.sample(this.city.eventItems);
                const state = this._pickItemState();
                this.logger.debug(`Drawing EVENT item ${itemId} on last LOT ${shuffledLots[index]} because no event item was drawn`);

                lot.items[lotItemsAmount] = new ItemState(itemId, state);
            }
        }
    }

    /**
     * @param {LotState} lotState
     * @private
     */
    _generateInitialBid(lotState, idx) {
        const baseBid = Math.round(lodash.random(this.city.minInitialBidRange, this.city.maxInitialBidRange));
        lotState.initialBid = Math.round(baseBid / this.city.minBidIncrement) * this.city.minBidIncrement;
        lotState.nextBidValue = lotState.initialBid;
        this.logger.debug(`Lot ${idx} city ${this.city.id} - initial bid value: ${baseBid} (rounded: ${lotState.initialBid})`);
    }

    /**
     * @return {LotState}
     * @private
     */
    _getCurrentLot() {
        return this.state.lots[this.state.currentLot];
    }

    /**
     * Updates the current bid and who owns the bid.
     */
    finishBidInterval() {
        if (!this.bidInterval) {
            this.logger.info(`NO one has yet bid on lot ${this.state.currentLot}. Starting countdown anyway.`);
            this._getCurrentLot().bidOwner = '';
        }
        else {
            const bidValue = this._getCurrentLot().nextBidValue;
            this._getCurrentLot().bidValue =  bidValue;
            this._setNextBidValue(bidValue);

            this._getCurrentLot().bidOwner = this.bidInterval.getWinner();
            this.logger.debug(`Trying to finish bid interval. bid: ${bidValue} from ${this.bidInterval.getWinner()}`);

            lodash.forEach(this.bidInterval.drawPlayers, (playerId) => {
                this.state.players[playerId].lastBid = bidValue;
            });
        }

        this.bidInterval = null;
        this.bidIntervalTimeout = null;

        if (this.lotEndTimeout) {
            this._getCurrentLot().dole = 0;
            this.lotEndTimeout.clear();
        }
        this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), Config.game.auctionAfterBidDuration);
    }

    /**
     * @param {number} index
     * @param {LotState} lot
     * @private
     */
    _generateLotItems(index, lot) {
        const lotItems = new MapSchema();
        const lotBoxes = new MapSchema();
        const lotBoxedItems = {};

        const lotItemsAmount = lodash.random(this.city.minimumItemsInLot, this.city.maximumItemsInLot);
        const lotJunkItemsAmount = lodash.random(this.city.minimumJunkItemsInLot, this.city.maximumJunkItemsInLot);

        this.logger.debug(`Lot ${index} will have ${lotItemsAmount} items and ${lotJunkItemsAmount} junk items`);

        let itemsPerRarity = {};
        let boxedItemsPerRarity = {};
        lodash.each(this.city.itemRarities, rarity => {
            itemsPerRarity[rarity] = 0;
            boxedItemsPerRarity[rarity] = 0;
        });

        let boxedItems = 0;
        let unboxedItems = 0;
        for (let index = 0; index < lotItemsAmount; index++) {

            const selectedRarity = this._pickItemRarity(itemsPerRarity);
            const itemId = lodash.sample(this.city.itemsRarity[selectedRarity].items);
            const state = this._pickItemState();
            const boxed = this._calculateItemBoxed(selectedRarity, boxedItemsPerRarity);
            //this.logger.debug(`Drawing item ${itemId}, state:${state} from rarity ${selectedRarity}, boxed: ${boxed}.`);

            itemsPerRarity[selectedRarity]++;

            if (boxed) {
                boxedItemsPerRarity[selectedRarity]++;
                const item = Config.getItem(itemId);
                const box = Config.getBox(item.boxType);

                this.logger.debug(`- Item ${item.id} - was boxed on ${box.id})`);
                lotBoxes[boxedItems] = new BoxState(box.id);
                lotBoxedItems[boxedItems] = {
                    itemId: item.id,
                    state,
                };
                boxedItems++;
            }
            else {
                lotItems[unboxedItems] = new ItemState(itemId, state);
                unboxedItems++;
            }
        }

        //add junkItems
        if (!lodash.isEmpty(this.city.junkItems)) {
            for (let index = 0; index < lotJunkItemsAmount; index++) {
                const itemId = lodash.sample(this.city.junkItems);
                const state = this._pickItemState();
                this.logger.debug(`Drawing JUNK item ${itemId}, state:${state}.`);

                lotItems[unboxedItems] = new ItemState(itemId, state);
                unboxedItems++;
            }
        }

        lot.items = lotItems;
        lot.boxes = lotBoxes;
        lot.boxedItems = lotBoxedItems;
    }

    /**
     * pick an item state depending on city config
     * @return  {string}    item state
     * @private
     */
    _pickItemState() {
        return 'WORN';
    }

    /**
     * @param {string} rarity
     * @param {Object} boxedItemsPerRarity
     * @return {boolean}
     * @private
     */
    _calculateItemBoxed(rarity, boxedItemsPerRarity) {
        const rarityConfig = this.city.itemsRarity[rarity];

        const frequencyModifier = rarityConfig.maximumBoxesPerRarity - boxedItemsPerRarity[rarity] * rarityConfig.boxProbabilityModifierOn;
        const boxRateModifier = rarityConfig.boxProbabilityModifier ** boxedItemsPerRarity[rarity];

        const probability = rarityConfig.boxProbability / rarityConfig.maximumBoxesPerRarity * frequencyModifier * boxRateModifier;

        const options = [true, false];
        const weights = [probability, 1 - probability];
        return weighted.select(options, weights);
    }

    /**
     * @param {Object} itemsPerRarity
     * @return {string}
     * @private
     */
    _pickItemRarity(itemsPerRarity) {
        //Probabilidade / MaxItems * (MaxItems - NumeroJaSorteado * OnOrOff) * Modifier ^ NumeroJaSorteado
        const weightedOptions = {};

        lodash.each(this.city.itemRarities, rarity => {
            const rarityConfig = this.city.itemsRarity[rarity];

            //TODO colocar common rarity em um enum
            if (rarity !== 'Common') {
                const frequencyModifier = rarityConfig.maximumItemsPerRarity - itemsPerRarity[rarity] * rarityConfig.drawProbabilityModifierOn;
                const dropRateModifier = rarityConfig.drawProbabilityModifier ** itemsPerRarity[rarity];

                const probability = rarityConfig.drawProbability / rarityConfig.maximumItemsPerRarity * frequencyModifier * dropRateModifier;

                weightedOptions[rarity] = probability;
            }
        });

        weightedOptions['Common'] = 1 - lodash.sum(lodash.map(weightedOptions));
        this.logger.debug(`probabilities ${JSON.stringify(weightedOptions)}`);

        return weighted.select(weightedOptions);
    }

    /**
     * Computes a player's bid.
     * @param {string} playerId
     */
    bid(playerId) {
        const playerState = this.state.players[playerId];

        this.logger.debug(`Player ${playerId} (Bot: ${playerState.isBot}) trying to bid ${this._getCurrentLot().nextBidValue} on lot ${this.state.currentLot}.`, {
            firebaseId: playerState.firebaseId,
        });

        if (this._getCurrentLot().bidOwner === playerId) {
            this.logger.debug(`Ignoring bid. Player ${playerId} is already winning`);
            return;
        }

        if (playerState.money < this._getCurrentLot().nextBidValue) {
            this.logger.debug(`Ignoring bid. Player ${playerId} has no money (${playerState.money}) for this bid ${this._getCurrentLot().nextBidValue}`);
            return;
        }

        if (this.bidInterval === null) {
            this.bidInterval = new BidInterval();
            if (this.bidIntervalTimeout) {
                this.bidIntervalTimeout.clear();
            }

            this.bidIntervalTimeout = this.room.clock.setTimeout(() => this.finishBidInterval(), Config.game.bidTimeTolerance);
        }

        this.logger.info(`Player ${playerId} (Bot: ${playerState.isBot}) bid ${this._getCurrentLot().nextBidValue} on lot ${this.state.currentLot}.`, {
            firebaseId: playerState.firebaseId,
        });

        this.bidInterval.addBid(playerId);
    }

    /**
     * Increments "dole" counter and finishes lot / starts new one when necessary.
     * @private
     */
    _runDole() {
        const currentLot = this._getCurrentLot();
        this.logger.debug(`Lot ${this.state.currentLot} current countdown: ${currentLot.dole}`);

        if (currentLot.dole === 3) {
            if (this.bidIntervalTimeout !== null) {
                this.bidIntervalTimeout.clear();
                this.finishBidInterval();

            } else {
                this._finishLot(this.state.currentLot);
                if (this.state.currentLot < this.lotsAmount - 1) {
                    this.state.currentLot = this.state.currentLot + 1;
                    this.playersLotReady = {};
                    this.bidStep = 0;
                    this.lotStartTimeout = this.room.clock.setTimeout(() => this._startInspect(true), Config.game.forceLotStartTimeout);
                } else {
                    this._finishAuction().catch(error => {
                        this.logger.error('Error while finishing auction.', error);
                    });
                }
            }

        } else {
            currentLot.dole++;
            this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), Config.game.auctionDoleDuration);
        }
    }

    /**
     * Send emoji message to all if possible
     * @param {string} playerId
     */
    tryToSendEmoji(playerId, message) {
        if (!this.lastSentEmoji[playerId] || (this.lastSentEmoji[playerId] + Config.game.playerEmojiCooldownMs) <= Date.now()) {
            this.lastSentEmoji[playerId] = Date.now();

            if (message.emoji && lodash.find(Config.emojis, emoji => message.emoji === emoji.id)) {
                this.room.broadcast(JSON.stringify(lodash.merge({client: playerId}, message)));
            }
            else {
                this.logger.warning(`EMOJI ${message.emoji} sent from ${playerId} not found on config`);
            }
        }
    }

    /**
     * Checks if all players are ready for the lot to start.
     * @param {string} playerId
     */
    tryToStartLot(playerId) {
        this.logger.debug(`Player ${playerId} ready, trying to start lot ${this.state.currentLot}`);
        this.playersLotReady[playerId] = true;

        let canStart = true;
        lodash.each(this.state.players, (player) => {
            if (player.connected && !this.playersLotReady[player.id]) {
                canStart = false;
            }
        });

        if (canStart) {
            this._startInspect(false);
        }
    }

    /**
     * Starts inspection state.
     * @param {boolean} forced
     * @private
     */
    _startInspect(forced) {
        const lotIndex = this.state.currentLot;

        if (lotIndex == 0) {
            this.gameStartedAtDateTime = Date.now();
        }

        if (this.state.lots[lotIndex].status !== auctionStatus.INSPECT) {
            this.state.lots[lotIndex].status = auctionStatus.INSPECT;
            this.logger.debug(`Starting ${auctionStatus.INSPECT} stage on LOT ${lotIndex} (forced? ${forced})`);

            if (this.lotStartTimeout !== null) {
                this.lotStartTimeout.clear();
            }

            this._notifyPlayerSkills();

            this.room.clock.setTimeout(() => this._startLot(lotIndex), Config.game.inspectDuration);
        }
    }

    /**
     * @param {number} lotIndex
     * @private
     */
    _startLot(lotIndex) {
        this.logger.info(`Starting LOT ${lotIndex}`);
        this.state.lots[lotIndex].status = auctionStatus.PLAY;

        //force lot end if noone bids
        this.bidIntervalTimeout = this.room.clock.setTimeout(() => this.finishBidInterval(), Config.game.zeroBidsLotTimeout);
    }

    /**
     * Finishes a lot, preparing the auction state for the next lot and decrementing the lot winner's money.
     * @param {number} lotIndex
     * @private
     */
    _finishLot(lotIndex) {
        let endingLot = this.state.lots[lotIndex];
        endingLot.status = auctionStatus.FINISHED;

        lodash.each(this.state.players, player => {
            player.lastBid = 0;
        });

        if (endingLot.bidOwner) {
            let bidOwnerState = this.state.players[endingLot.bidOwner];
            bidOwnerState.money = (Number(bidOwnerState.money) || 0) - endingLot.bidValue;

            this.logger.info(`Ended LOT ${lotIndex} - Winner: ${endingLot.bidOwner} - paid:${endingLot.bidValue}`);
        }
    }

    addItemStats(valuePerRarity, item) {
        let key = item.rarity;
        if (key === 'Common' && item.category === 'junk') {
            key = 'junk';
        }

        const quantity = valuePerRarity[key].quantity + 1;
        const total = valuePerRarity[key].totalPrice + item.price;
        const avg = total / quantity;
        valuePerRarity[key] = {
            quantity: quantity,
            totalPrice: total,
            avgPrice: avg,
        };

        return valuePerRarity;
    }

    /**
     * @private
     */
    async _calculateRewards() {
        const endGameResults = {};
        lodash.each(this.state.players, player => {
            endGameResults[player.firebaseId] = {
                isBot: player.isBot,
                firebaseId: player.firebaseId,
                playerId: player.id,
                price: 0,
                score: 0,
                items: {},
                trophies: 0,
                position: 0,
            };
        });

        lodash.each(this.state.lots, lotState => {
            let valuePerRarity = {};
            let statKeys = lodash.clone(Config.getItemRarities());
            statKeys.push('junk');

            lodash.forEach(statKeys, key => {
                valuePerRarity[key] = {
                    quantity: 0,
                    totalPrice: 0,
                    avgPrice: 0,
                };
            });

            lodash.each(lotState.boxes, (boxState, idx) => {
                boxState.itemId = lotState.boxedItems[idx].itemId;
                boxState.state = lotState.boxedItems[idx].state;

                const item = Config.getItem(boxState.itemId);
                lotState.lotItemsPrice += itemStateHelper.getItemPrice(Config, item.price, boxState.state);
                valuePerRarity = this.addItemStats(valuePerRarity, item);
            });

            lodash.each(lotState.items, lotItem => {
                const item = Config.getItem(lotItem.itemId);
                lotState.lotItemsPrice += itemStateHelper.getItemPrice(Config, item.price, lotItem.state);
                valuePerRarity = this.addItemStats(valuePerRarity, item);
            });

            this.logger.info('Match Lot info', {
                bwsMatch: {
                    cityId: this.city.id,
                    lotValue: lotState.lotItemsPrice,
                    cityMaxMoney: this.city.maximumMoney,
                },
            });

            lodash.forEach(lodash.keys(valuePerRarity), key => {
                this.logger.info('Match Lot item info', {
                    bwsMatch: {
                        rarity: key,
                        cityId: this.city.id,
                        quantity: valuePerRarity[key].quantity,
                        totalPrice: valuePerRarity[key].totalPrice,
                        avgPrice: valuePerRarity[key].avgPrice,
                    },
                });
            });

            if (lotState.bidOwner) {
                let playerResult = endGameResults[this.state.players[lotState.bidOwner].firebaseId];

                playerResult.price += lotState.bidValue;
                playerResult.score += lotState.lotItemsPrice - lotState.bidValue;

                // TODO join stage items and boxed items before this
                lodash.each(lotState.items, lotItem => {
                    const key = `${lotItem.itemId}-${lotItem.state}`;
                    if (playerResult.items[key]) {
                        playerResult.items[key].quantity += 1;
                    }
                    else {
                        playerResult.items[key] = {
                            itemId: lotItem.itemId,
                            quantity: 1,
                            state: lotItem.state,
                        };
                    }
                });

                lodash.each(lotState.boxes, (boxState, _idx) => {
                    const key = `${boxState.itemId}-${boxState.state}`;
                    if (playerResult.items[key]) {
                        playerResult.items[key].quantity += 1;
                    }
                    else {
                        playerResult.items[key] = {
                            itemId: boxState.itemId,
                            quantity: 1,
                            state: boxState.state,
                        };
                    }
                });
            }
        });

        const resultsOrdered = lodash.sortBy(endGameResults, reward => -reward.score);
        this.logger.info(`Game Ended. Results: ${JSON.stringify(resultsOrdered)}`);

        const rewards = {};
        lodash.each(resultsOrdered, (result, idx) => {

            let trophies = this.city.trophyRewards[idx];
            let position = idx + 1;
            if (idx > 0 && result.score === resultsOrdered[idx - 1].score) {
                trophies = resultsOrdered[idx - 1].trophies;
                position = resultsOrdered[idx - 1].position;
            }

            resultsOrdered[idx].trophies = trophies;
            resultsOrdered[idx].position = position;

            let trophiesBalanced = trophies;

            if (!result.isBot) {
                const player = this.state.players[result.playerId];

                if (player.trophies >= this.city.trophyThresholdMax && trophies > 0) {
                    trophiesBalanced = 0;
                }

                rewards[result.firebaseId] = {
                    city: this.city.id,
                    trophies: trophiesBalanced,
                    position: position,
                    price: result.price,
                    items: result.items,
                    abtestgroup: player.abtestgroup,
                };

                this.logger.info('Game result tally.', {
                    bwsMatch: {
                        firebaseId: result.firebaseId,
                        cityId: this.city.id,
                        trophies: trophies,
                        position: position,
                        score: result.score,
                    },
                });
            }

            this.state.players[result.playerId].trophiesEarned = trophies;
        });

        const eventParams = {
            arena: this.city.id,
            room_id: this.room.roomId,
            entry_fee: this.city.minimumMoney,
            total_bots: lodash.keys(this.room.bots).length,
            user_ids: [],
            characters: [],
            total_trophies: [],
            position: [],
            match_profit: [],
            lockers_purchased: [],
            interrupted: [],
            reconnected: [],
        };

        let botCounter = 1;
        lodash.forEach(resultsOrdered, result => {
            const playerState = this.state.players[result.playerId];

            let analyticsUserId = result.firebaseId;
            if (playerState.isBot) {
                analyticsUserId = `bot_${botCounter}`;
                botCounter++;
            }
            eventParams.user_ids.push(analyticsUserId);
            eventParams.characters.push(playerState.character);

            eventParams.total_trophies.push(playerState.trophies + result.trophies);
            eventParams.position.push(result.position);
            eventParams.interrupted.push(playerState.interruptions);
            eventParams.reconnected.push(playerState.reconnections);

            let lockersPurchased = 0;
            lodash.forEach(this.state.lots, lot => {
                if (lot.bidOwner === playerState.id) {
                    lockersPurchased += 1;
                }
            });
            eventParams.lockers_purchased.push(lockersPurchased);

            let itemsValue = 0;
            lodash.forEach(result.items, (item, _id) => {
                const price = itemStateHelper.getItemPrice(Config, Config.getItem(item.itemId).price, item.state);
                itemsValue += item.quantity * price;
            });
            eventParams.match_profit.push(itemsValue - result.price);
        });

        try {
            await bigQueryHelper.insert({
                eventName: 'match_finished',
                eventParams,
                userIds: eventParams.user_ids,
            });
        } catch (error) {
            const newError = new Error(error.message);
            newError.oldStack = error.stack;
            this.logger.error('Failed to log match finished analytics.', newError);
        }

        this.logger.info(`Sending rewards ${JSON.stringify(rewards)}`);
        return rewards;
    }

    /**
     * End the current auction and send the player's rewards.
     * @return {Promise<void>}
     * @private
     */
    async _finishAuction() {
        const rewards = await this._calculateRewards();

        this.state.status = auctionStatus.FINISHED;

        try {
            const response = await rewardDao.saveRewards(rewards);

            if (!lodash.isEmpty(response)) {
                lodash.forEach(response, (rank, firebaseId) => {
                    const player = lodash.find(this.state.players, player => player.firebaseId === firebaseId);
                    const client = lodash.find(this.room.clients, client => client.id === player.id);

                    if (!client || !player.connected) {
                        this.logger.info('Player disconnected. Unable to send rank-up message.', {
                            firebaseId,
                        });

                    } else {
                        this.room.send(client, JSON.stringify({ rank: rank }));

                        this.logger.info(`Player ${client.id} was rewarded the rank ${rank}`, {
                            firebaseId,
                        });
                    }
                });
            }

            this.state.status = auctionStatus.REWARDS_SENT;
        } catch (error) {
            this.logger.critical(`Failed to save rewards. Error: ${error.message} - ${error.stack}`, rewards);
            this.state.status = auctionStatus.REWARDS_ERROR;
        }

        this.logger.info(`GAME ENDED. closing room in ${Math.ceil(Config.game.disposeRoomTimeout / 1000)} seconds`);

        this.room.clock.setTimeout(() => {
            if (this.room) {
                this.logger.info('GAME ENDED. disposing room if needed');
                this.room.disconnect();
            }
        }, Config.game.disposeRoomTimeout);
    }

    _findSkillProbability(player, profile, skillConfig) {
        let skillLevel;
        if (!player.isBot) {
            skillLevel = lodash.find(skillConfig.levelProgression, sp => sp.level === profile.character.level);

            if (lodash.isUndefined(skillLevel)) {
                this.logger.warning(`Cannot get right skill ${skillConfig.id} level to user=${player.id}. Failed to get skill level. level=${profile.character.level}`, {
                    firebaseId: player.firebaseId,
                });

                const maxLevel = lodash.maxBy(skillConfig.levelProgression, function(o) { return o.level; });
                // Get the last level.
                if (profile.character.level > maxLevel) {
                    skillLevel = lodash.find(skillConfig.levelProgression, sp => sp.level === maxLevel);
                }
                else{
                    this.logger.error(`Cannot get skill ${skillConfig.id} level to user=${player.id}. Failed to get skill level. level=${profile.character.level}`, {
                        firebaseId: player.firebaseId,
                    });
                    return 0;
                }
            }
        }
        else {
            skillLevel = lodash.sample(skillConfig.levelProgression);
        }

        const skillProbability = skillLevel.probability;
        if (lodash.isUndefined(skillProbability)) {
            this.logger.error(`Cannot apply skill ${skillConfig.id} to user=${player.id}. Probability is undefined. skill level=${JSON.stringify(skillLevel)}`, {
                firebaseId: player.firebaseId,
            });
            return 0;
        }

        return skillProbability;
    }

    /**
     * Apply the players skills, sending a message with affected items or boxes.
     */
    async _notifyPlayerSkills() {

        const currentLot = this._getCurrentLot();

        // Interact each real player.
        lodash.each(this.state.players, player => {
            if (player.isBot) {
                return; // Same as continue;
            }
            let notification = {}; // Base awnser.

            // Get player's skills
            const profile = this._getPlayerProfile(player);
            const characterConfig = Config.getCharacter(profile.character.id);

            // Character can have more than one skill.
            lodash.each(characterConfig.skills, skillId => {
                const skillConfig = Config.getSkill(skillId);
                if (!skillConfig) {
                    this.logger.error(`Cannot apply skill to user=${player.id}. Skill config ${skillId} not found.`, {
                        firebaseId: player.firebaseId,
                    });
                    return;
                }

                // Execute skill highlight odds.
                if (skillConfig.type === 'highlight') {
                    const skillItemCategory = skillConfig.category;
                    const skillItemRarity = skillConfig.rarity;
                    const skillProbability = this._findSkillProbability(player, profile, skillConfig);

                    // Get all itens based on rarity and category.
                    lodash.each(currentLot.items, lotItem => {
                        const lotItemConfig = Config.getItem(lotItem.itemId);
                        const rarityFound = lodash.find(skillItemRarity, r => r === lotItemConfig.rarity);

                        if (!lodash.isUndefined(rarityFound)) {
                            if (lotItemConfig.category === skillItemCategory && lodash.random(0.0, 1.0, true) <= skillProbability) {
                                if (lodash.isUndefined(notification.highlight) || lodash.isNull(notification.highlight)) {
                                    notification.highlight = [];
                                }
                                notification.highlight.push({ itemId: lotItem.itemId } );
                            }
                        }
                    });
                }
                // Execute skill xray odds.
                else if (skillConfig.type === 'xray') {
                    const skillProbability = this._findSkillProbability(player, profile, skillConfig);
                    const skillItemRarity = skillConfig.rarity;

                    lodash.each(currentLot.boxes, (box, idx) => {
                        const boxedItemId = currentLot.boxedItems[idx].itemId;
                        const lotItemConfig = Config.getItem(boxedItemId);
                        const rarityFound = lodash.find(skillItemRarity, r => r === lotItemConfig.rarity);

                        if (rarityFound && lodash.random(0.0, 1.0, true) <= skillProbability) {
                            if (lodash.isUndefined(notification.xray) || lodash.isNull(notification.xray)) {
                                notification.xray = [];
                            }
                            notification.xray.push({ index: idx, boxId: box.boxId , itemId: boxedItemId } );
                        }
                    });
                }
            });

            // Any notification to send to client?
            if (!lodash.isEmpty(notification)) {
                const client = lodash.find(this.room.clients, client => client.id === player.id);
                if (!client || !player.connected) {
                    this.logger.info(`Player ${player.firebaseId} disconnected. Unable to send skill message.`);
                } else {
                    this.logger.info(`Player ${player.id} got skills. ${JSON.stringify(notification)}`);
                    this.room.send(client, JSON.stringify(notification));
                }
            }
        });
    }

    /**
     * Apply a power.
     * @param {string} playerId
     * @param {object} message Protocol with power effect command.
     * message.powerId
     * message.targetId
     */
    tryToApplyPower(playerId, message) {
        const now = Date.now();
        // Get power config.

        const powerConfig = Config.getPower(message.powerId);
        if (!powerConfig) {
            this.logger.error(`PlayerId=${playerId} trying to user unknown powerId=${message.powerId}`);
            return;
        }
        // Check if can use (delay start game)
        if (this.gameStartedAtDateTime + powerConfig.delayMs > now) {
            this.logger.error(`PlayerId=${playerId} trying to user unknown powerId=${message.powerId}`);
            return;
        }

        // TODO: Check if player have enough power available.

        // Check if player cooldown is finished.
        const playerState = this.state.players[playerId];
        const playerPower = lodash.find(playerState.powers, power => message.powerId === power.id);
        if (!playerPower) {
            // Player doesn't have this power to apply! Hacking?
            this.logger.info(`PlayerId=${playerId} trying to use powerId=${message.powerId} but doesn't have it.`);
            return;
        }
        if (playerPower.expiration > now) {
            // Cooldown not finished.
            this.logger.info(`PlayerId=${playerId} trying to use powerId=${message.powerId} but cooldown not finished.`);
            return;
        }

        // Check if target player is not suffering effect from this power.
        let targetPlayerState;
        if (lodash.isUndefined(message.targeId)) {
            targetPlayerState = playerState;
        } else {
            targetPlayerState = this.state.players[message.targetId];
        }

        if (targetPlayerState.effects[message.powerId]) {
            if (targetPlayerState.effects[message.powerId].expiration > now) {
                this.logger.info(`Target PlayerId=${targetPlayerState.id} is suffering effect from powerId=${message.powerId}.`);
            }
        }

        playerPower.expiration = now + powerConfig.cooldownMs;

        // Create effect state setting parameters, than add to effect list.
        targetPlayerState.effects[message.powerId] = new EffectState(
            {
                id: message.powerId,
                owner: playerId,
                target: message.targetId,
                expiration: now + powerConfig.durationMs,
            });

        if (this.expirePowerEffectTimeout == null) {
            this._expirePowerEffect();
        }
    }

    /**
     * Remove expired power effects from players.
     */
    _expirePowerEffect() {
        const now = Date.now();
        let nextExpireEffect = 0;

        lodash.each(this.state.players, (player) => {
            const toRemove = [];
            player.effect = lodash.filter(player.effects, effect => effect.expiration < now);
            lodash.each(player.effects, (effect) => {
                if (effect.expiration < now) {
                    toRemove.push(effect.id);
                } else {
                    if (nextExpireEffect == 0 || effect.expiration < nextExpireEffect)  {
                        nextExpireEffect = effect.expiration;
                    }
                }
            });
            lodash.forEach(toRemove, key =>{
                delete player.effects[key];
            });
        });

        if (nextExpireEffect > 0) {
            this.logger.debug(`Next expirePowerEffect in ${nextExpireEffect - now} miliseconds`);
            this.expirePowerEffectTimeout = this.room.clock.setTimeout(() => this._expirePowerEffect(), nextExpireEffect - now);
        } else {
            this.expirePowerEffectTimeout = null;
        }
    }
}

module.exports = {
    AuctionController,
};
