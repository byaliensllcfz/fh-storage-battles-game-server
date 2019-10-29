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
        this.state.auction.push(new AuctionState());
        this.state.auction[0].bidValue = this.configs.game.bidIncrement;
        this.state.status = 'PLAY';

        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionInitialDuration);
        this._drawItems(lodash.random(5,8));
    }

    getNextBidValue() {
        let bidValue = this.state.auction[0].bidValue;
        if (this.state.auction[0].bidOwner !== '') {
            bidValue += this.configs.game.bidIncrement;
        }
        return bidValue;
    }

    finishBidInterval() {
        const bidValue = this.getNextBidValue();
        this.state.auction[0].bidValue = bidValue;
        this.state.auction[0].bidOwner = this.bidInterval.getWinner();
        lodash.forEach(this.bidInterval.drawPlayers, (playerId) => {
            this.state.players[playerId].lastBid = bidValue;
        });
        this.bidInterval = null;
        this.bidIntervalTimeout = null;

        if (this.auctionEndTimeout) {
            this.state.auction[0].dole = 0;
            this.auctionEndTimeout.clear();
        }
        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionAfterBidDuration);
    }

    _drawItems(itemAmount){
        let itemsStart = new MapSchema();
        let playableItems = this.configs.items;
        for (let i = 0; i < itemAmount; i++) {
            itemsStart[i] = lodash.sample(playableItems).id;
        }
        this.state.auction[0].items = itemsStart;
    }

    bid(playerId) {
        if(this.state.auction[0].bidOwner === playerId){return;}
        if(this.state.players[playerId].money < this.getNextBidValue()){return;}

        if(this.bidInterval === null){
            this.bidInterval = new BidInterval();
            this.bidIntervalTimeout = this.room.clock.setTimeout(() => this.finishBidInterval(), this.configs.game.bidTimeTolerance);
        }
        this.bidInterval.addBid(playerId);
    }


    _runDole() {
        if (this.state.auction[0].dole === 3) {
            if (this.bidIntervalTimeout !== null) {
                this.bidIntervalTimeout.clear();
                this.finishBidInterval();
            } else {
                this._finishAuction();
            }
        } else {
            this.state.auction[0].dole++;
            this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionDoleDuration);
        }
    }

    async _finishAuction() {
        this.state.status = 'FINISHED';

        if (this.state.auction[0].bidOwner) {
            const winner = this.state.auction[0].bidOwner;
            const rewards = {};

            lodash.each(this.state.players, player => {
                if (player.id === winner) {
                    const items = {};
                    lodash.each(this.state.auction[0].items, itemId => {
                        items[itemId] = (items[itemId] || 0) + 1;
                    }),
                    // TODO: setup the correct rewards
                    rewards[player.firebaseId] = {
                        price: this.state.auction[0].bidValue,
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