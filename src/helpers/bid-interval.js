const lodash = require('lodash');

class BidInterval {
    constructor() {
        this.drawPlayers = [];
    }

    addBid(bidId) {
        if (!this.drawPlayers.includes(bidId)) {
            this.drawPlayers.push(bidId);
        }
    }

    getWinner() {
        return this.drawPlayers[lodash.random(this.drawPlayers.length - 1)];
    }
}

module.exports = {
    BidInterval,
};
