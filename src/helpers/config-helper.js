'use strict';

/** @ignore */
let _config = null;

/**
 * @typedef {Object} Config
 * @property {Object} game
 * @property {number} game.maxPlayers
 * @property {number} game.bidTimeTolerance
 * @property {number} game.playerStartMoney
 * @property {number} game.bidIncrement
 * @property {number} game.maxItems
 * @property {number} game.auctionDoleDuration
 * @property {number} game.maxStorages
 * @property {number} game.initialBid
 * @property {number} game.pawnDuration
 * @property {number} game.playerStartSlots
 * @property {number} game.auctionAfterBidDuration
 * @property {number} game.auctionInitialDuration
 * @property {number} game.bidCooldown
 * @property {number} game.overbidWindow
 * @property {number} game.lotsAmount
 * @property {number} game.forceLotStartTimeout
 * @property {number} game.inspectDuration
 * @property {number} game.allowReconnectionTimeSec
 * @property {Object[]} cities
 * @property {Object[]} items
 */

/**
 * @param {Config} config
 */
function set(config) {
    _config = config;
}

/**
 * @returns {Config}
 */
function get() {
    return _config;
}

module.exports = {
    set,
    get,
};
