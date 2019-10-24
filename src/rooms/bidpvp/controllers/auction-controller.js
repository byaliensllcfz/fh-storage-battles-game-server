'use strict';

const lodash = require('lodash');
const {MapSchema} = require('@colyseus/schema');

const configHelper = require('../../../helpers/config-helper');
const profileDao = require('../../../daos/profile-dao');
const rewardDao = require('../../../daos/reward-dao');

class AuctionController {
    constructor(room) {
        this.room = room;
        this.state = room.state;
        this.randomSeed = lodash.random(-100000, 100000);
        this.auctionEndTimeout = null;
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
            player.money = 1000 + Math.floor(Math.random()*1000);
        });

        this.state.auction.bidValue = this.configs.game.bidIncrement;
        this.state.status = 'PLAY';

        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionInitialDuration);
        this._drawItems(lodash.random(5,8));
    }

    bid(playerId) {
        let nextBid = this.state.auction.bidValue;

        if (this.state.auction.bidOwner !== '') {
            nextBid += this.configs.game.bidIncrement;
        }

        if (this.state.auction.bidOwner !== playerId && nextBid <= this.state.players[playerId].money) {
            this.state.auction.bidValue = nextBid;
            this.state.auction.bidOwner = playerId;
        }

        if (this.auctionEndTimeout) {
            this.state.auction.dole = 0;
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
        this.state.auction.items = itemsStart;
    }

    _runDole() {
        if (this.state.auction.dole === 3) {
            this._finishAuction();
        } else {
            this.state.auction.dole++;
            this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionDoleDuration);
        }
    }

    async _finishAuction() {
        if (this.state.auction.bidOwner) {
            const winner = this.state.auction.bidOwner;
            const rewards = {};

            lodash.each(this.state.players, player => {
                if (player.id === winner) {
                    const items = {};
                    lodash.each(this.state.auction.items, itemId => {
                        items[itemId] = (items[itemId] || 0) + 1;
                    }),
                    // TODO: setup the correct rewards
                    rewards[player.firebaseId] = {
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

        this.state.status = 'FINISHED';
    }
}

module.exports = {
    AuctionController,
};