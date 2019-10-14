'use strict';

const { Logger } = require('@tapps-games/logging');
const logger = new Logger();

const itemsJson = require('../data/items.json');

let allItems;
async function loadAllData() {
    logger.info('Refreshing all server saved data');
    allItems = itemsJson;
}

function getAllItems() {
    return allItems;
}

module.exports = {
    loadAllData,
    getAllItems,
};