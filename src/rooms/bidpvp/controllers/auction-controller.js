'use strict';

const lodash = require('lodash');
const config = require('../../../data/game.json');

class AuctionController {
    constructor(room) {
        this.room = room;
        this.state = room.state;
    }

    startAuction() {
        lodash.each(this.state.players, (player) => {
            player.money = 1000 + Math.floor(Math.random()*1000);
        });

        this.state.auction.bidValue = config.bidIncrement;
        this.state.status = 'PLAY';
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
    }  
    
}

module.exports = {
    AuctionController,
};