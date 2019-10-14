'use strict';

const commands = require('../../../data/commands.json');

function auctionHandler(room, _playerId, message = {}) {
    if (message.command === commands.AUCTION_START) {
        room.auctionController.startAuction();
    }
}

module.exports = {
    auctionHandler,
};