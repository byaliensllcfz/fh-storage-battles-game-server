'use strict';

const { commands } = require('../../../types');

async function handleAuctionCommand(room, playerId, message = {}) {
    if (message.command === commands.AUCTION_START) {
        await room.auctionController.startAuction();

    } else if (message.command === commands.AUCTION_BID) {
        room.auctionController.bid(playerId);
    }
}

module.exports = {
    handleAuctionCommand,
};
