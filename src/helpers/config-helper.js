'use strict';

/** @ignore */
let _config = null;

/**
 * @typedef {Object} CityConfig
 * @property {string} id
 * @property {string} name
 * @property {number} trophiesToUnlock
 * @property {number[]} trophyRewards
 * @property {number[]} availableItems
 * @property {number} minimumMoney
 * @property {number} maximumMoney
 * @property {number} minimumItemsPerLot
 * @property {number} maximumItemsPerLot
 * @property {number} minimumBoxesPerLot
 * @property {number} maximumBoxesPerLot
 */

/**
 * @typedef {Object} ItemConfig
 * @property {string} id
 * @property {string} name
 * @property {string} archive
 * @property {string} category
 * @property {string} rarity
 * @property {number} price
 */

/**
 * @typedef {Object} BoxConfig
 * @property {string} id
 * @property {string} size
 */

/**
 * @typedef {Object} Config
 *
 * @property {Object} game
 * @property {number} game.maxPlayers
 * @property {number} game.bidTimeTolerance
 * @property {number} game.playerStartMoney
 * @property {number} game.bidIncrement
 * @property {number} game.auctionDoleDuration
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
 * @property {string[]} game.characters
 *
 * @property {Object} bot
 * @property {number} bot.minimumMoneyModifier
 * @property {number} bot.maximumMoneyModifier
 * @property {number} bot.minimumTimeToBidSeconds
 * @property {number} bot.maximumTimeToBidSeconds
 * @property {number} bot.averageBoxValue
 * @property {number} bot.minimumItemValueModifier
 * @property {number} bot.maximumItemValueModifier
 * @property {number} bot.minimumBidProbability
 * @property {number} bot.bidProbabilityOnProfit
 * @property {number} bot.idealProfitModifier
 * @property {number} bot.addBotTimeoutMinimum
 * @property {number} bot.addBotTimeoutMaximum
 * @property {number} bot.minimumTrophiesModifier
 * @property {number} bot.maximumTrophiesModifier
 * @property {string[]} bot.names
 * @property {string[]} bot.profilePictures
 *
 * @property {CityConfig[]} cities
 * @property {ItemConfig[]} items
 * @property {BoxConfig[]} boxes
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
