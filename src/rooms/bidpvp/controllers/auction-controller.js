'use strict';

const lodash = require('lodash');
const weighted = require('weighted');
const { MapSchema } = require('@colyseus/schema');
const { Logger } = require('@tapps-games/logging');

const bigQueryHelper = require('../../../helpers/big-query-helper');
const profileDao = require('../../../daos/profile-dao');
const rewardDao = require('../../../daos/reward-dao');
const { auctionStatus } = require('../../../types');
const { BidInterval } = require('../../../helpers/bid-interval');
const { Config } = require('../../../helpers/config-helper');
const { LotState } = require('../schemas/lot-state');
const { BoxState } = require('../schemas/box-state');

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

        /** @type {number} */
        this.lotsAmount = Config.game.lotsAmount;

        /** @type {CityConfig} */
        this.city = Config.cities[cityId];

        this.logger = new Logger('AuctionController', { room: this.room.roomId });

        this._generateLots(this.lotsAmount);
    }

    /**
     * @return {Promise<void>}
     */
    async startAuction() {
        // Avoid duplicated calls to start auction
        if (this._started) {
            return;
        }
        this._started = true;

        lodash.each(this.state.players, player => {
            if (player.isBot) {
                const bot = this.room.bots[player.firebaseId];
                player.name = bot.name;
                player.photoUrl = bot.profilePicture;
                player.money = bot.startingMoney;
                player.trophies = bot.trophies;
                player.rank = bot.rank;
            }
            else {
                const playerData = this.profiles[player.firebaseId];
                player.name = playerData.profile.alias;
                player.photoUrl = playerData.profile.picture;
                player.money = lodash.min([playerData.currencies.softCurrency, this.city.maximumMoney]);
                player.trophies = playerData.currencies.trophies;
                player.rank = playerData.currencies.rank;
            }
        });

        this.state.status = auctionStatus.PLAY;
        this.state.currentLot = 0;
        this.lotStartTimeout = this.room.clock.setTimeout(() => this._startInspect(true), Config.game.forceLotStartTimeout);
    }

    async validatePlayerProfile(userId) {
        const profiles = await profileDao.getProfiles([userId]);
        const profile = profiles[userId];

        if (profile && profile.profile && profile.currencies) {
            this.profiles[userId] = profile;
            return true;

        } else {
            return false;
        }
    }

    /**
     * Calculates the next bid value and updates the state.
     * @param {number} currentBid
     */
    setNextBidValue(currentBid) {
        //Doc: https://tappsgames.atlassian.net/wiki/spaces/PD/pages/977633395/Comportamento+do+Auctioneer

        //Caculate exponential incremental value
        let incrementalFactor = this._exponentialIncrementalFactor(currentBid);
        incrementalFactor = Math.floor(Math.max(0, incrementalFactor));

        // see if exponential increment will be used
        let exponentialToggle = incrementalFactor - this._exponentialIncrementalFactor(Config.game.linearPosValue) + 0.001;
        exponentialToggle = Math.max(0, exponentialToggle);
        this.logger.debug(`CurrentBid: ${currentBid}, incrementalFactor: ${incrementalFactor}, exponentialToggle: ${exponentialToggle}`);

        incrementalFactor = incrementalFactor * (0 ** exponentialToggle);
        const exponentialGrowth = Config.game.bidBaseIncrement * Config.game.bidBaseMultiplier ** incrementalFactor;
        this.logger.debug(`CurrentBid: ${currentBid}, incrementalFactorAfterToggle: ${incrementalFactor}, exponentialGrowth: ${exponentialGrowth}`);

        //calculate linear incremental value
        let delta = (Config.game.bidBaseIncrementLinear * Config.game.bidRepeatValueLinear) / Config.game.bidBaseMultiplierLinear;
        const linearModifier = this._linearModifier(currentBid, delta);

        // see if linear increment will be used
        let linearToggle = linearModifier - this._linearModifier(Config.game.linearPosValue, delta) + 0.001;
        linearToggle = Math.abs(Math.min(0, linearToggle));
        this.logger.debug(`CurrentBid: ${currentBid}, linearModifier: ${linearModifier}, linearToggle: ${linearToggle}, delta: ${delta}`);

        const linearGrowth = linearModifier * Config.game.bidBaseIncrementLinear * ( 0 ** linearToggle );
        this.logger.debug(`CurrentBid: ${currentBid}, linearGrowth: ${linearGrowth}`);

        //increments the bid by linear OR exponential growth (one of them will be 0)
        let bidIncrement = exponentialGrowth + linearGrowth;

        this._getCurrentLot().nextBidValue = Math.round(bidIncrement + currentBid);

        this.logger.debug(`CurrentBid: ${currentBid}, bidIncrement: ${bidIncrement}, nextBid:${this._getCurrentLot().nextBidValue}`);
    }

    _linearModifier(bidOrToggle, delta) {
        return Math.floor ( ( delta + ( Math.sqrt( ( (-1 * delta) ** 2 ) - ( 4 * delta * -1 * bidOrToggle) ) ) ) / 2 * delta );
    }

    _exponentialIncrementalFactor(bidOrToggle) {
        return Math.log(bidOrToggle / (Config.game.bidBaseIncrement * Config.game.bidRepeatValue )) / Math.log(Config.game.bidBaseMultiplier);
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
            this._generateInitialBid(newLot);
        }
    }

    /**
     * @param {LotState} lotState
     * @private
     */
    _generateInitialBid(lotState) {
        let totalEstimatedValue = lodash.keys(lotState.boxes).length * this.city.estimatedBoxValue;

        lodash.each(lotState.items, itemId => {
            totalEstimatedValue += Config.getItem(itemId).price;
        });

        this.logger.info(`Lot total estimated value: ${totalEstimatedValue}`);
        const minValue = (Config.game.minimumInitialBidPercentage / 100) * totalEstimatedValue;
        const maxValue = (Config.game.maximumInitialBidPercentage / 100) * totalEstimatedValue;

        const baseBid = Math.round(lodash.random(minValue, maxValue));
        lotState.nextBidValue = Math.ceil(baseBid / Config.game.bidBaseIncrement) * Config.game.bidBaseIncrement;
        this.logger.info(`Lot initial bid value: ${baseBid} (rounded: ${lotState.nextBidValue})`);
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
        const bidValue = this._getCurrentLot().nextBidValue;
        this._getCurrentLot().bidValue =  bidValue;

        this.setNextBidValue(bidValue);
        this._getCurrentLot().bidOwner = this.bidInterval.getWinner();

        this.logger.debug(`Trying to finish bid interval. bid: ${bidValue} from ${this.bidInterval.getWinner()}`);

        lodash.forEach(this.bidInterval.drawPlayers, (playerId) => {
            this.state.players[playerId].lastBid = bidValue;
        });
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
        this.logger.debug(`Lot ${index} will have ${lotItemsAmount} items`);

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
            const boxed = this._calculateItemBoxed(selectedRarity, boxedItemsPerRarity);
            this.logger.debug(`Drawing item ${itemId} from rarity ${selectedRarity}, boxed: ${boxed}.`);

            itemsPerRarity[selectedRarity]++;

            if (boxed) {
                boxedItemsPerRarity[selectedRarity]++;
                const item = Config.getItem(itemId);
                const box = Config.getBox(item.boxType);

                this.logger.debug(`- Item ${item.id} - was boxed on ${box.id})`);
                lotBoxes[boxedItems] = new BoxState(box.id);
                lotBoxedItems[boxedItems] = item.id;
                boxedItems++;
            }
            else {
                lotItems[unboxedItems] = itemId;
                unboxedItems++;
            }
        }

        lot.items = lotItems;
        lot.boxes = lotBoxes;
        lot.boxedItems = lotBoxedItems;
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

        this.logger.info(`Player ${playerId} (Bot: ${playerState.isBot}) trying to bid ${this._getCurrentLot().nextBidValue} on lot ${this.state.currentLot}.`, {
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
            this.bidIntervalTimeout = this.room.clock.setTimeout(() => this.finishBidInterval(), Config.game.bidTimeTolerance);
        }
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

        if (this.state.lots[lotIndex].status !== auctionStatus.INSPECT) {
            this.state.lots[lotIndex].status = auctionStatus.INSPECT;
            this.logger.debug(`Starting ${auctionStatus.INSPECT} stage on LOT ${lotIndex} (forced? ${forced})`);

            if (this.lotStartTimeout !== null) {
                this.lotStartTimeout.clear();
            }

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
            lodash.each(lotState.boxes, (boxState, idx) => {
                boxState.itemId = lotState.boxedItems[idx];
                const item = Config.getItem(boxState.itemId);
                lotState.lotItemsPrice += item.price;
            });

            lodash.each(lotState.items, itemId => {
                const item = Config.getItem(itemId);
                lotState.lotItemsPrice += item.price;
            });

            if (lotState.bidOwner) {
                let playerResult = endGameResults[this.state.players[lotState.bidOwner].firebaseId];

                playerResult.price += lotState.bidValue;
                playerResult.score += lotState.lotItemsPrice - lotState.bidValue;

                lodash.each(lotState.items, itemId => {
                    playerResult.items[itemId] = (playerResult.items[itemId] || 0) + 1;
                });

                lodash.each(lotState.boxes, (boxState, _idx) => {
                    playerResult.items[boxState.itemId] = (playerResult.items[boxState.itemId] || 0) + 1;
                });
            }
        });

        const resultsOrdered = lodash.sortBy(endGameResults, reward => -reward.score);
        this.logger.info(`Game Ended. Results: ${JSON.stringify(resultsOrdered)}`);

        const rewards = {};
        lodash.each(resultsOrdered, (result, idx) => {

            let trophies = this.city.trophyRewards[idx];

            if (idx > 0 && result.score === resultsOrdered[idx - 1].score) {
                trophies = resultsOrdered[idx - 1].trophies;
            }

            resultsOrdered[idx].trophies = trophies;
            resultsOrdered[idx].position = lodash.indexOf(this.city.trophyRewards, trophies);

            if (!result.isBot) {
                rewards[result.firebaseId] = {
                    trophies: trophies,
                    price: result.price,
                    items: result.items,
                };
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
            eventParams.position.push(result.position + 1);
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
            lodash.forEach(result.items, (quantity, id) => {
                itemsValue += quantity * Config.getItem(id).price;
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
            this.logger.error('Failed to log match finished analytics.', error);
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
                this.room._dispose();
            }
        }, Config.game.disposeRoomTimeout);
    }
}

module.exports = {
    AuctionController,
};
