'use strict';

const lodash = require('lodash');
const {MapSchema} = require('@colyseus/schema');

const configHelper = require('../../../helpers/config-helper');
const profileDao = require('../../../daos/profile-dao');

class AuctionController {
    constructor(room) {
        this.room = room;
        this.state = room.state;
        this.auctionEndTimeout = null;

        this.configs = configHelper.get();
    }

    async startAuction() {
        lodash.each(this.state.players, (player) => {
            player.money = 1000 + Math.floor(Math.random()*1000);
        });
        
        // const ids = this.state.players.map(p => p.id);
        // const profiles = await profileDao.getProfiles(ids);

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
            this.state.status = 'FINISHED';
        } else {
            this.state.auction.dole++;
            this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), this.configs.game.auctionDoleDuration);
        }
    }
}

module.exports = {
    AuctionController,
};