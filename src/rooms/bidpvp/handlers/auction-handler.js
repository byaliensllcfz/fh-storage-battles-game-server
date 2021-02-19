'use strict';

const { auctionStatus, commands } = require('../../../types');

async function handleAuctionCommand(room, playerId, message = {}) {
    if (message.command === commands.AUCTION_BID && room.auctionController.getCurrentLotStatus() === auctionStatus.PLAY) {
        room.auctionController.bid(playerId);
    }
    else if (message.command === commands.AUCTION_LOT_READY && room.auctionController.getCurrentLotStatus() === auctionStatus.WAITING) {
        room.auctionController.tryToStartLot(playerId);
    }
    else if (message.command === commands.EMOJI && room.auctionController.getCurrentLotStatus() === auctionStatus.PLAY) {
        room.auctionController.tryToSendEmoji(playerId, message.args);
    }
    else if (message.command === commands.POWER && room.auctionController.getCurrentLotStatus() === auctionStatus.PLAY) {
        room.auctionController.tryToApplyPower(playerId, message.args);
    }
    else if (message.command === commands.BUY_POWER && room.auctionController.getCurrentLotStatus() === auctionStatus.PLAY) {
        room.auctionController.tryReloadPowerAmount(playerId, message.args);
    }
}

module.exports = {
    handleAuctionCommand,
};
