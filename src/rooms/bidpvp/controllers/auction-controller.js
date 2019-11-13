'use strict';

const lodash = require('lodash');
const weighted = require('weighted');

const { MapSchema } = require('@colyseus/schema');
const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

const profileDao = require('../../../daos/profile-dao');
const rewardDao = require('../../../daos/reward-dao');
const { auctionStatus } = require('../../../types');
const { BidInterval } = require('../../../helpers/bid-interval');
const { Config } = require('../../../helpers/config-helper');
const { LotState } = require('../schemas/lot-state');
const { BoxState } = require('../schemas/box-state');

class AuctionController {
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

        this.lotsAmount = Config.game.lotsAmount;
        this.city = Config.cities[cityId];

        this._generateLots(this.lotsAmount);
    }

    async startAuction() {
        // Avoid duplicated calls to start auction
        if (this._started) {
            return;
        }
        this._started = true;

        const playerIds = [];
        lodash.forEach(this.state.players, player => {
            if (!player.isBot) {
                playerIds.push(player.firebaseId);
            }
        });
        const profiles = await profileDao.getProfiles(playerIds);

        lodash.each(this.state.players, player => {
            if (player.isBot) {
                const bot = this.room.bots[player.firebaseId];
                player.name = bot.name;
                player.photoUrl = bot.profilePicture;
                player.money = bot.startingMoney;

            } else {
                const playerState = lodash.find(profiles, profileData => profileData.profile.gameUserId === player.firebaseId);
                player.name = playerState.profile.alias;
                player.photoUrl = playerState.profile.picture;
                player.money = playerState.currencies.softCurrency;
            }
        });

        this.state.status = auctionStatus.PLAY;
        this.state.currentLot = 0;
        this.lotStartTimeout = this.room.clock.setTimeout(() => this._startInspect(true), Config.game.forceLotStartTimeout);
    }

    setNextBidValue(currentBid) {
        let incrementalFactor = Math.log(currentBid / Config.game.bidBaseIncrement) / Math.log(Config.game.bidBaseMultiplier);
        incrementalFactor = Math.floor(Math.max(0, incrementalFactor));

        const growth = Config.game.bidBaseIncrement * Config.game.bidBaseMultiplier ** incrementalFactor;
        this._getCurrentLot().nextBidValue = Math.round((growth / Config.game.bidRepeatValue) + currentBid);

        logger.debug(`CurrentBid: ${currentBid}, incrementalFactor:${incrementalFactor}, Growth:${growth}, nextBid:${this._getCurrentLot().nextBidValue}`);
    }

    getCurrentLotStatus() {
        return this._getCurrentLot().status;
    }

    _generateLots(lotAmount) {
        for (let index = 0; index < lotAmount; index++) {
            let newLot = new LotState();
            this.state.lots.push(newLot);

            this._generateLotItems(index, newLot);
            this._generateInitialBid(newLot);
        }
    }

    _generateInitialBid(lotState) {
        let totalEstimatedValue = 0;
        lodash.each(lotState.boxes, (boxState, _idx) => {
            totalEstimatedValue += Config.getBox(boxState.boxId).estimatedValue;
        });

        lodash.each(lotState.items, itemId => {
            totalEstimatedValue += Config.getItem(itemId).price;
        });

        logger.debug(`Lot total estimated value: ${totalEstimatedValue}`);
        const minValue = (Config.game.minimumInitialBidPercentage / 100) * totalEstimatedValue;
        const maxValue = (Config.game.maximumInitialBidPercentage / 100) * totalEstimatedValue;

        const baseBid = Math.round(lodash.random(minValue, maxValue));
        lotState.nextBidValue = Math.floor(baseBid / Config.game.bidBaseIncrement) * Config.game.bidBaseIncrement;
        logger.debug(`Lot initial bid value: ${baseBid} (rounded: ${lotState.nextBidValue})`);
    }

    _getCurrentLot() {
        return this.state.lots[this.state.currentLot];
    }

    finishBidInterval() {
        const bidValue = this._getCurrentLot().nextBidValue;
        this._getCurrentLot().bidValue =  bidValue;

        this.setNextBidValue(bidValue);
        this._getCurrentLot().bidOwner = this.bidInterval.getWinner();

        logger.debug(`Trying to finish bid interval. bid:${bidValue} from ${this.bidInterval.getWinner()}`);

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

    _generateLotItems(index, lot) {
        const lotItems = new MapSchema();
        const lotBoxes = new MapSchema();
        const lotBoxedItems = {};

        const lotItemsAmount = lodash.random(this.city.minimumItemsInLot, this.city.maximumItemsInLot);
        logger.debug(`Lot ${index} will have ${lotItemsAmount} items`);

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
            logger.debug(`Drawing item ${itemId} from rarity ${selectedRarity}, boxed: ${boxed}.`);

            itemsPerRarity[selectedRarity]++;

            if (boxed) {
                boxedItemsPerRarity[selectedRarity]++;
                const item = Config.getItem(itemId);
                const box = Config.getBox(item.boxType);

                logger.debug(`- Item ${item.id} - was boxed on ${box.id})`);
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

    _calculateItemBoxed(rarity, boxedItemsPerRarity) {
        const rarityConfig = this.city.itemsRarity[rarity];

        const frequencyModifier = rarityConfig.maximumBoxesPerRarity - boxedItemsPerRarity[rarity] * rarityConfig.boxProbabilityModifierOn;
        const boxRateModifier = rarityConfig.boxProbabilityModifier ** boxedItemsPerRarity[rarity];

        const probability = rarityConfig.boxProbability / rarityConfig.maximumBoxesPerRarity * frequencyModifier * boxRateModifier;

        const options = [true, false];
        const weights = [probability, 1 - probability];
        return weighted.select(options, weights);
    }

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
        logger.debug(`probabilities ${JSON.stringify(weightedOptions)}`);

        return weighted.select(weightedOptions);
    }

    bid(playerId) {
        logger.debug(`Player ${playerId} trying to bid ${this._getCurrentLot().nextBidValue}`);

        if (this._getCurrentLot().bidOwner === playerId) {
            logger.debug(`Ignoring bid. Player ${playerId} is already winning`);
            return;
        }
        if (this.state.players[playerId].money < this._getCurrentLot().nextBidValue) {
            logger.debug(`Ignoring bid. Player ${playerId} has no money (${this.state.players[playerId].money}) for this bid ${this._getCurrentLot().nextBidValue}`);
            return;
        }

        if (this.bidInterval === null) {
            this.bidInterval = new BidInterval();
            this.bidIntervalTimeout = this.room.clock.setTimeout(() => this.finishBidInterval(), Config.game.bidTimeTolerance);
        }
        this.bidInterval.addBid(playerId);
    }

    _runDole() {
        logger.debug(`countdown on current LOT : ${this._getCurrentLot().dole}`);
        if (this._getCurrentLot().dole === 3) {
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
                        logger.error('Error while finishing auction.', error);
                    });
                }
            }

        } else {
            this._getCurrentLot().dole++;
            this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), Config.game.auctionDoleDuration);
        }
    }

    tryToStartLot(playerId) {
        logger.debug(`Player ${playerId} ready, trying to start lot ${this.state.currentLot}`);
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

    _startInspect(forced) {
        const lotIndex = this.state.currentLot;

        if (this.state.lots[lotIndex].status !== auctionStatus.INSPECT) {
            this.state.lots[lotIndex].status = auctionStatus.INSPECT;
            logger.debug(`Starting Inspect stage on LOT ${lotIndex} (forced? ${forced})`);

            if (this.lotStartTimeout !== null) {
                this.lotStartTimeout.clear();
            }

            this.room.clock.setTimeout(() => this._startLot(lotIndex), Config.game.inspectDuration);
        }
    }

    _startLot(lotIndex) {
        logger.debug(`Starting LOT ${lotIndex}`);
        this.state.lots[lotIndex].status = auctionStatus.PLAY;
        this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), Config.game.auctionInitialDuration);
    }

    _finishLot(lotIndex) {
        let endingLot = this.state.lots[lotIndex];
        endingLot.status = auctionStatus.FINISHED;

        lodash.each(this.state.players, player => {
            player.lastBid = 0;
        });

        if (endingLot.bidOwner) {
            let bidOwnerState = this.state.players[endingLot.bidOwner];
            bidOwnerState.money = (Number(bidOwnerState.money) || 0) - endingLot.bidValue;
        }
    }

    _calculateRewards() {
        const endGameResults = {};
        lodash.each(this.state.players, player => {
            endGameResults[player.firebaseId] = {
                isBot: player.isBot,
                firebaseId: player.firebaseId,
                playerId: player.id,
                price: 0,
                score: 0,
                items: {},
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
            }
        });

        const resultsOrdered = lodash.sortBy(endGameResults, reward => -reward.score);
        logger.debug(`Game Ended. Results: ${JSON.stringify(resultsOrdered)}`);

        const rewards = {};
        lodash.each(resultsOrdered, (result, idx) => {

            let trophies = this.city.trophyRewards[idx];
            if (idx > 0 && result.score === resultsOrdered[idx -1].score) {
                trophies = rewards[resultsOrdered[idx -1].firebaseId].trophies;
            }

            if (!result.isBot) {
                rewards[result.firebaseId] = {
                    trophies: trophies,
                    price: result.price,
                    items: result.items,
                };
            }

            this.state.players[result.playerId].trophiesEarned = trophies;
        });

        logger.debug(`Sending rewards ${JSON.stringify(rewards)}`);
        return rewards;
    }

    async _finishAuction() {
        this.state.status = auctionStatus.FINISHED;

        const rewards = this._calculateRewards();
        try {
            await rewardDao.saveRewards(rewards);
            this.state.status = auctionStatus.REWARDS_SENT;

        } catch (error) {
            // TODO: Retry sending rewards later?
            logger.critical(`Failed to save rewards. Error: ${error.message} - ${error.stack}`, rewards);
        }
    }
}

module.exports = {
    AuctionController,
};
