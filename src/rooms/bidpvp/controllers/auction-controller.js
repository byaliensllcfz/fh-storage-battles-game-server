'use strict';

const lodash = require('lodash');
const config = require('../../../data/game.json');

class AuctionController {
    constructor(room) {
        this.room = room;
        this.state = room.state;

        this.auctionEndTimeout = null;
    }

    startAuction() {
        lodash.each(this.state.players, (player) => {
            player.money = 1000 + Math.floor(Math.random()*1000);
        });

        this.state.auction.bidValue = config.bidIncrement;
        this.state.status = 'PLAY';

        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), config.auctionInitialDuration);
    }

    bid(playerId) {
        let nextBid = this.state.auction.bidValue;

        if (this.state.auction.bidOwner !== '') {
            nextBid += config.bidIncrement;
        }

        if (this.state.auction.bidOwner !== playerId && nextBid <= this.state.players[playerId].money) {
            this.state.auction.bidValue = nextBid;
            this.state.auction.bidOwner = playerId;
        }

        if (this.auctionEndTimeout) {
            this.state.auction.dole = 0;
            this.auctionEndTimeout.clear();
        }
        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), config.auctionAfterBidDuration);
    }

    _runDole() {
        if (this.state.auction.dole === 3) {
            this.state.status = 'FINISHED';
        } else {
            this.state.auction.dole++;
            this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), config.auctionDoleDuration);
        }
    }
}

module.exports = {
    AuctionController,
};