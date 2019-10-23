'use strict';

const { commands } = require('../../../types');

function auctionHandler(room, playerId, message = {}) {
    if (message.command === commands.AUCTION_START) {
        room.auctionController.startAuction();

    } else if (message.command === commands.AUCTION_BID) {
        room.auctionController.bid(playerId);
    }
}

module.exports = {
    auctionHandler,
};