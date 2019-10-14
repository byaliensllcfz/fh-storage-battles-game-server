'use strict';

const lodash = require('lodash');

class AuctionController {
    constructor(room) {
        this.room = room;
        this.state = room.state;
    }

    startAuction() {
        lodash.each(this.state.players, (player) => {
            player.money = 1000 + Math.floor(Math.random()*1000);
        });

        this.state.auction.bidValue = 100;
        this.state.status = 'PLAY';
    }
}

module.exports = {
    AuctionController,
};