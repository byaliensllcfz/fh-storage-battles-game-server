'use strict';

const { auctionStatus, commands } = require('../../../types');

async function handleAuctionCommand(room, playerId, message = {}) {
    if (message.command === commands.AUCTION_BID && room.auctionController.getCurrentLotStatus() === auctionStatus.PLAY) {
        room.auctionController.bid(playerId);
    }
    else if (message.command === commands.AUCTION_LOT_READY && room.auctionController.getCurrentLotStatus() === auctionStatus.WAITING) {
        room.auctionController.tryToStartLot(playerId);
    }
}

module.exports = {
    handleAuctionCommand,
};
