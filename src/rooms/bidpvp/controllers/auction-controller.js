'use strict';

const lodash = require('lodash');
const { MapSchema } = require('@colyseus/schema');
const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

const configHelper = require('../../../helpers/config-helper');
const profileDao = require('../../../daos/profile-dao');
const rewardDao = require('../../../daos/reward-dao');
const { auctionStatus } = require('../../../types');
const { BidInterval } = require('../../../helpers/bid-interval');
const { LotState } = require('../schemas/lot-state');

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

        this.configs = configHelper.get();

        this.lotsAmount = this.configs.game.lotsAmount;
        this.city = lodash.find(this.configs.cities, city => city.id = cityId);

        this._generateLots(this.lotsAmount);
    }

    async startAuction() {
        // Trying to avoid duplicated calls to start auction
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
                player.money = bot.money;

            } else {
                const playerState = lodash.find(profiles, profileData => profileData.profile.gameUserId === player.firebaseId);
                player.name = playerState.profile.alias;
                player.photoUrl = playerState.profile.picture;
                player.money = playerState.stats.softCurrency;
            }
        });

        this.state.status = auctionStatus.PLAY;
        this.state.currentLot = 0;
        this.lotStartTimeout = this.room.clock.setTimeout(() => this._startInspect(true), this.configs.game.forceLotStartTimeout);
    }

    getNextBidValue() {
        return this._getCurrentLot().bidValue + this.configs.game.bidIncrement;
    }

    getCurrentLotStatus() {
        return this._getCurrentLot().status;
    }

    _generateLots(lotAmount) {
        for (let index = 0; index < lotAmount; index++) {
            let newLot = new LotState();
            this.state.lots.push(newLot);
            this._drawItems(lodash.random(5, 8), newLot); // TODO: Get amount of items and boxes from city config
            this._addBoxes(1, newLot);
        }
    }

    _getCurrentLot() {
        return this.state.lots[this.state.currentLot];
    }

    finishBidInterval() {
        const bidValue = this.getNextBidValue();
        this._getCurrentLot().bidValue = bidValue;
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
        this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionAfterBidDuration);
    }

    _addBoxes(boxesAmount, lot) {
        const boxes = new MapSchema();
        const boxesConfig = this.configs.boxes;
        for (let i = 0; i < boxesAmount; i++) {
            const config = lodash.sample(boxesConfig);
            boxes[i] = config.id;
        }
        lot.boxes = boxes;
    }

    _drawItems(itemAmount, lot) {
        const itemsStart = new MapSchema();
        const playableItems = this.configs.items;
        for (let i = 0; i < itemAmount; i++) {
            const config = lodash.sample(playableItems);
            itemsStart[i] = config.id;
            lot.lotItemsPrice += config.price;
        }
        lot.items = itemsStart;
    }

    bid(playerId) {
        logger.debug(`Player ${playerId} trying to bid ${this.getNextBidValue()}`);

        if (this._getCurrentLot().bidOwner === playerId) {
            logger.debug(`Ignoring bid. Player ${playerId} is already winning`);
            return;
        }
        if (this.state.players[playerId].money < this.getNextBidValue()) {
            logger.debug(`Ignoring bid. Player ${playerId} has no money (${this.state.players[playerId].money}) for this bid ${this.getNextBidValue()}`);
            return;
        }

        if (this.bidInterval === null) {
            this.bidInterval = new BidInterval();
            this.bidIntervalTimeout = this.room.clock.setTimeout(() => this.finishBidInterval(), this.configs.game.bidTimeTolerance);
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
                    this.lotStartTimeout = this.room.clock.setTimeout(() => this._startInspect(true), this.configs.game.forceLotStartTimeout);
                } else {
                    this._finishAuction().catch(error => {
                        logger.error('Error while finishing auction.', error);
                    });
                }
            }

        } else {
            this._getCurrentLot().dole++;
            this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionDoleDuration);
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

            this.room.clock.setTimeout(() => this._startLot(lotIndex), this.configs.game.inspectDuration);
        }
    }

    _startLot(lotIndex) {
        logger.debug(`Starting LOT ${lotIndex}`);
        this.state.lots[lotIndex].status = auctionStatus.PLAY;
        this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionInitialDuration);
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
