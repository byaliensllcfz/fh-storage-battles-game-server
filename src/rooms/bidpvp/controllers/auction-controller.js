'use strict';

const { BidInterval } = require('.BidInterval');
const lodash = require('lodash');
const config = require('../../../data/game.json');
const { MapSchema } = require('@colyseus/schema');
const configService = require('../../../services/config-service');

class AuctionController {
    constructor(room) {
        this.room = room;
        this.state = room.state;
        this.state.randomSeed = lodash.random(-100000, 100000);
        this.auctionEndTimeout = null;
        this.bidInterval = null;
        this.bidIntervalTimeout = null;
    }

    drawItems(itemAmount){
        let itemsStart = new MapSchema();
        let playableItems = configService.getAllItems();
        for (let i = 0; i < itemAmount; i++) {
            itemsStart[i] = lodash.sample(playableItems).id;
        }
        this.state.auction.items = itemsStart;
    }

    startAuction() {
        lodash.each(this.state.players, (player) => {
            player.name = 'PLAYER NAME';
            player.photoUrl = 'https://upload.wikimedia.org/wikipedia/en/1/16/Drevil_million_dollars.jpg';
            player.money = 1000 + Math.floor(Math.random()*1000);
        });

        this.state.auction.bidValue = config.bidIncrement;
        this.state.status = 'PLAY';

        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), config.auctionInitialDuration);
        this.drawItems(lodash.random(5,8));
    }

    getNextBidValue(){
        let bidValue = this.state.auction.bidValue;
        if (this.state.auction.bidOwner !== '') {
            bidValue += config.bidIncrement;
        }
        return bidValue;
    }

    finishBidInterval(){
        const bidValue = this.getNextBidValue();
        this.state.auction.bidValue = bidValue;
        this.state.auction.bidOwner = this.bidInterval.getWinner();
        lodash.forEach(this.bidInterval.drawPlayers, function(playerId){
            this.state.players[playerId].lastBid = bidValue;
        });
        this.bidInterval = null;
        this.bidIntervalTimeout = null;

        if (this.auctionEndTimeout) {
            this.state.auction.dole = 0;
            this.auctionEndTimeout.clear();
        }
        this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), config.auctionAfterBidDuration);
    }

    bid(playerId) {
        if(this.state.auction.bidOwner === playerId){return;}
        if(this.state.players[playerId].money < this.getNextBidValue()){return;}

        if(this.bidInterval === null){
            this.bidInterval = new BidInterval();
            this.bidIntervalTimeout = this.room.clock.setTimeout(this.finishBidInterval, config.bidTimeTolerance);
        }
        this.bidInterval.addBid(playerId);
    }


    _runDole() {
        if (this.state.auction.dole === 3) {
            if(this.bidIntervalTimeout !== null){
                this.bidIntervalTimeout.clear;
                this.finishBidInterval();
            }else{
                this.state.status = 'FINISHED';
            }
        } else {
            this.state.auction.dole++;
            this.auctionEndTimeout = this.room.clock.setTimeout(() => this._runDole(), config.auctionDoleDuration);
        }
    }
}

module.exports = {
    AuctionController,
};