'use strict';

const lodash = require('lodash');
const { MapSchema } = require('@colyseus/schema');
const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

const configHelper = require('../../../helpers/config-helper');
const profileDao = require('../../../daos/profile-dao');
const rewardDao = require('../../../daos/reward-dao');
const { BidInterval } = require('../../../helpers/bid-interval');
const { LotState } = require('../schemas/lot-state');

class AuctionController {
    constructor(room) {
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
        this._generateLots(this.lotsAmount);
    }

    async startAuction() {
        // Trying to avoid duplicated calls to start auction
        if (this._started) {
            return;
        }
        this._started = true;

        const ids = lodash.map(this.state.players, player => player.firebaseId);
        const profiles = await profileDao.getProfiles(ids);

        lodash.each(this.state.players, (player) => {
            let playerData = lodash.find(profiles, profileData => profileData.profile.gameUserId === player.firebaseId);
            player.name = playerData.profile.alias;
            player.photoUrl = playerData.profile.picture;
            player.money = playerData.stats.softCurrency;
        });
        this.state.status = 'PLAY';
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
            this._drawItems(lodash.random(5, 8), newLot);
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

    _drawItems(itemAmount, lot) {
        let itemsStart = new MapSchema();
        let playableItems = this.configs.items;
        for (let i = 0; i < itemAmount; i++) {
            let config = lodash.sample(playableItems);
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

        if (this.state.lots[lotIndex].status !== 'INSPECT') {
            this.state.lots[lotIndex].status = 'INSPECT';
            logger.debug(`Starting Inspect stage on LOT ${lotIndex} (forced? ${forced})`);

            if (this.lotStartTimeout !== null) {
                this.lotStartTimeout.clear();
            }

            this.room.clock.setTimeout(() => this._startLot(lotIndex), this.configs.game.inspectDuration);
        }
    }

    _startLot(lotIndex) {
        logger.debug(`Starting LOT ${lotIndex}`);
        this.state.lots[lotIndex].status = 'PLAY';
        this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionInitialDuration);
    }

    _finishLot(lotIndex) {
        let endingLot = this.state.lots[lotIndex];
        endingLot.status = 'FINISHED';

        lodash.each(this.state.players, player => {
            player.lastBid = 0;
        });

        if (endingLot.bidOwner) {
            let bidOwnerState = this.state.players[endingLot.bidOwner];
            bidOwnerState.money = (Number(bidOwnerState.money) || 0) - endingLot.bidValue;
        }
    }

    _calculateRewards() {
        const rewards = {};
        lodash.each(this.state.players, player => {
            rewards[player.firebaseId] = {
                // TODO: setup the correct rewards
                trophies: 10,
                price: 0,
                items: {},
            };
        });

        lodash.each(this.state.lots, lotState => {
            if (lotState.bidOwner) {
                let winnerRewards = rewards[this.state.players[lotState.bidOwner].firebaseId];
                // TODO: setup the correct rewards
                winnerRewards.trophies = 20;
                winnerRewards.price += lotState.bidValue;
                lodash.each(lotState.items, itemId => {
                    winnerRewards.items[itemId] = (winnerRewards.items[itemId] || 0) + 1;
                });
            }
        });
        return rewards;
    }

    async _finishAuction() {
        this.state.status = 'FINISHED';

        await rewardDao.saveRewards(this._calculateRewards()); // TODO: deal with request failing.

        this.state.status = 'REWARDS_SENT';
    }
}

module.exports = {
    AuctionController,
};
