'use strict';

const lodash = require('lodash');
const {MapSchema} = require('@colyseus/schema');

const configHelper = require('../../../helpers/config-helper');
const profileDao = require('../../../daos/profile-dao');
const rewardDao = require('../../../daos/reward-dao');
const { BidInterval } = require('../../../helpers/bid-interval');
const {AuctionState} = require('../schemas/auction-state');

class AuctionController {
    constructor(room) {
        this.room = room;
        this.state = room.state;
        this.state.randomSeed = lodash.random(-100000, 100000);
        this.auctionEndTimeout = null;
        this.bidInterval = null;
        this.bidIntervalTimeout = null;
        this._started = false;

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
        this._generateLots(5);
        
        this._getCurrentLot().bidValue = this.configs.game.bidIncrement;
        this.state.status = 'PLAY';

        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionInitialDuration);
    }

    getNextBidValue() {
        let bidValue = this._getCurrentLot().bidValue;
        if (this._getCurrentLot().bidOwner !== '') {
            bidValue += this.configs.game.bidIncrement;
        }
        return bidValue;
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

        if (this.auctionEndTimeout) {
            this._getCurrentLot().dole = 0;
            this.auctionEndTimeout.clear();
        }
        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionAfterBidDuration);
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
                this._finishAuction();
            }
        } else {
            this._getCurrentLot().dole++;
            this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionDoleDuration);
        }
    }

    async _finishAuction() {
        this.state.status = 'FINISHED';

        if (this._getCurrentLot().bidOwner) {
            const winner = this._getCurrentLot().bidOwner;
            const rewards = {};

            lodash.each(this.state.players, player => {
                if (player.id === winner) {
                    const items = {};
                    lodash.each(this._getCurrentLot().items, itemId => {
                        items[itemId] = (items[itemId] || 0) + 1;
                    }),
                    // TODO: setup the correct rewards
                    rewards[player.firebaseId] = {
                        price: this._getCurrentLot().bidValue,
                        trophies: 20,
                        items,
                    };
                } else {
                    rewards[player.firebaseId] = {
                        trophies: 10,
                    };
                }
            });

            await rewardDao.saveRewards(rewards);
        }
    }
}

module.exports = {
    AuctionController,
};