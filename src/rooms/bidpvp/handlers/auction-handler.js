'use strict';

const { commands } = require('../../../types');
const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

async function handleAuctionCommand(room, playerId, message = {}) {
    logger.debug(`Command from ${playerId} : ${JSON.stringify(message)}`);

    if (message.command === commands.AUCTION_START) {
        await room.auctionController.startAuction();
    }
    else if (message.command === commands.AUCTION_BID && room.auctionController.getCurrentLotStatus() === 'PLAY') {
        room.auctionController.bid(playerId);
    }
    else if (message.command === commands.AUCTION_LOT_READY && room.auctionController.getCurrentLotStatus() === 'WAITING') {
        room.auctionController.tryToStartLot(playerId);
    }
}

module.exports = {
    handleAuctionCommand,
};
