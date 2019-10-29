'use strict';

const lodash = require('lodash');
const { MapSchema } = require('@colyseus/schema');

const configHelper = require('../../../helpers/config-helper');
const profileDao = require('../../../daos/profile-dao');
const rewardDao = require('../../../daos/reward-dao');
const { BidInterval } = require('../../../helpers/bid-interval');
const { AuctionState } = require('../schemas/auction-state');

class AuctionController {
    constructor(room) {
        this.room = room;
        this.state = room.state;
        this.state.randomSeed = lodash.random(-100000, 100000);
        this.lotEndTimeout = null;
        this.bidInterval = null;
        this.bidIntervalTimeout = null;
        this._started = false;
        this.lotsAmount = 5;

        this.configs = configHelper.get();
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
            let profile = lodash.find(profiles, profile => profile.id === player.firebaseId);
            player.name = profile.alias;
            player.photoUrl = profile.picture;
            player.money = profile.softCurrency;
        });

        this._generateLots(this.lotsAmount);
        this.state.status = 'PLAY';
        this._startLot(0);
    }

    getNextBidValue() {
        return this._getCurrentLot().bidValue + this.configs.game.bidIncrement;
    }

    _generateLots(lotAmount){
        for (let index = 0; index < lotAmount; index++) {
            let newLot  = new AuctionState();
            this.state.lots.push(newLot);
            this._drawItems(lodash.random(5,8), newLot);
        }
    }

    _getCurrentLot(){
        return this.state.lots[this.state.currentLot];
    }

    finishBidInterval() {
        const bidValue = this.getNextBidValue();
        this._getCurrentLot().bidValue = bidValue;
        this._getCurrentLot().bidOwner = this.bidInterval.getWinner();
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

    _drawItems(itemAmount, lot){
        let itemsStart = new MapSchema();
        let playableItems = this.configs.items;
        for (let i = 0; i < itemAmount; i++) {
            itemsStart[i] = lodash.sample(playableItems).id;
        }
        lot.items = itemsStart;
    }

    bid(playerId) {
        if(this._getCurrentLot().bidOwner === playerId){return;}
        if(this.state.players[playerId].money < this.getNextBidValue()){return;}

        if(this.bidInterval === null){
            this.bidInterval = new BidInterval();
            this.bidIntervalTimeout = this.room.clock.setTimeout(() => this.finishBidInterval(), this.configs.game.bidTimeTolerance);
        }
        this.bidInterval.addBid(playerId);
    }


    _runDole() {
        if (this._getCurrentLot().dole === 3) {
            if (this.bidIntervalTimeout !== null) {
                this.bidIntervalTimeout.clear();
                this.finishBidInterval();
            } else {
                this._finishLot(this.state.currentLot);
                if(this.state.currentLot < this.lotsAmount - 1){
                    this._startLot(this.state.currentLot + 1);
                }else{
                    this._finishAuction();
                }
            }
        } else {
            this._getCurrentLot().dole++;
            this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionDoleDuration);
        }
    }

    _startLot(lotIndex){
        this.state.currentLot = lotIndex;
        this.state.lots[lotIndex].status = 'PLAY';
        this.lotEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionInitialDuration);
    }

    _finishLot(lotIndex){
        let endingLot = this.state.lots[lotIndex];
        endingLot.status = 'FINISHED';

        lodash.each(this.state.players, player => {
            player.lastBid = 0;
        });

        if (endingLot.bidOwner) {
            let bidOwnerState = this.state.players[endingLot.bidOwner];
            bidOwnerState.money = (Number(bidOwnerState.money)  || 0) - endingLot.bidValue;
        }
    }

    _calculateRewards(){
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
            if(lotState.bidOwner){
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

        await rewardDao.saveRewards(this._calculateRewards());
    }
}

module.exports = {
    AuctionController,
};