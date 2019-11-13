'use strict';

const lodash  = require('lodash');
const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

/** @ignore */
let _config = null;
let _itemRarities;

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
 * @property {Object<string, ItemRarity>} itemsRarity
 */

/**
 * @typedef {Object} ItemRarity
 * @property {string} rarity
 * @property {number} drawProbability
 * @property {number} maximumItemsPerRarity
 * @property {number} drawProbabilityModifier
 * @property {number} drawProbabilityModifierOn
 * @property {number} boxProbability
 * @property {number} maximumBoxesPerRarity
 * @property {number} boxProbabilityModifier
 * @property {number} boxProbabilityModifierOn
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
 * @property {number} estimatedValue
 */

/**
 * @typedef {Object} GameConfig
 * @property {number} maxPlayers
 * @property {number} bidTimeTolerance
 * @property {number} auctionDoleDuration
 * @property {number} auctionAfterBidDuration
 * @property {number} auctionInitialDuration
 * @property {number} bidCooldown
 * @property {number} bidBaseIncrement
 * @property {number} bidBaseMultiplier
 * @property {number} bidRepeatValue
 * @property {number} overbidWindow
 * @property {number} lotsAmount
 * @property {number} forceLotStartTimeout
 * @property {number} inspectDuration
 * @property {number} allowReconnectionTimeSeconds
 * @property {string[]} characters
 */

/**
 * @typedef {Object} BotConfig
 * @property {number} minimumMoneyModifier
 * @property {number} maximumMoneyModifier
 * @property {number} minimumTimeToBidSeconds
 * @property {number} maximumTimeToBidSeconds
 * @property {number} minimumItemValueModifier
 * @property {number} maximumItemValueModifier
 * @property {number} minimumBidProbability
 * @property {number} bidProbabilityOnProfit
 * @property {number} idealProfitModifier
 * @property {number} addBotTimeoutMinimum
 * @property {number} addBotTimeoutMaximum
 * @property {number} minimumTrophiesModifier
 * @property {number} maximumTrophiesModifier
 * @property {string[]} names
 * @property {string[]} profilePictures
 */

class Config {

    static set(config) {
        _itemRarities = lodash.uniqBy(config.items, 'rarity').map(item => item.rarity);

        config.defaultItem = config.items[0];
        config.defaultBox = config.boxes[0];

        config.cities = lodash.keyBy(config.cities, city => city.id);
        config.items = lodash.keyBy(config.items, item => item.id);
        config.boxes = lodash.keyBy(config.boxes, box => box.id);

        _separateCityItemsPerRarity(config);

        _config = config;
    }

    /**
     * @return {GameConfig}
     */
    static get game() {
        return _config.game;
    }

    /**
     * @return {BotConfig}
     */
    static get bot() {
        return _config.bot;
    }

    /**
     * @return {Object<id, CityConfig>}
     */
    static get cities() {
        return _config.cities;
    }

    /**
     * @return {Object<id, ItemConfig>}
     */
    static get items() {
        return _config.items;
    }

    /**
     * @return {ItemConfig}
     */
    static getItem(itemId) {
        let item = _config.items[itemId];
        if (!item) {
            item = _config.defaultItem;
            logger.critical(`Couldnt find item ${itemId} - returning ${_config.defaultItem.id}`);
        }

        return item;
    }

    /**
     * @return {Object<id, BoxConfig>}
     */
    static get boxes() {
        return _config.boxes;
    }


    /**
     * @return {BoxConfig}
     */
    static getBox(boxId) {
        let box = _config.boxes[boxId];
        if (!box) {
            box = _config.defaultBox;
            logger.critical(`Couldnt find box ${boxId} - returning ${_config.defaultBox.id}`);
        }

        return box;
    }
}

function _separateCityItemsPerRarity(config) {
    lodash.each(_itemRarities, rarity => {
        const itemsForRarity = lodash.filter(config.items, item => item.rarity === rarity).map(item => item.id);

        lodash.each(config.cities, city => {
            if (!city.itemRarities) {
                city.itemRarities = [];
            }

            const cityItemsForRarity = lodash.intersection(itemsForRarity, city.availableItems);

            logger.debug(`City ${city.id}, rarity ${rarity} - Items: ${JSON.stringify(cityItemsForRarity)}`);
            city.itemsRarity[rarity].items = cityItemsForRarity;

            if (!lodash.isEmpty(cityItemsForRarity)) {
                city.itemRarities.push(rarity);
            }
        });
    });
}

module.exports = {
    Config,
};
