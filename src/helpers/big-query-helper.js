'use strict';

const lodash = require('lodash');
const { config } = require('@tapps-games/core');
const { BigQuery } = require('@google-cloud/bigquery');

const packageJson = require('../../package');

const DATASET_ID = 'bid_pvp_alpha';
const TABLE_ID = 'server_analytics';

const bigQueryClient = new BigQuery();
const dataset = bigQueryClient.dataset(DATASET_ID);
const table = dataset.table(TABLE_ID);

/**
 * Converts an object into an array of objects containing the keys and values.
 * @param {Object} json
 * @return {Object[]}
 * @private
 */
function _jsonToRecord(json) {
    return lodash.map(json, (value, key) => {
        const param = { key };

        if (lodash.isInteger(value)) {
            param.integer_value = value;

        } else if (lodash.isNumber(value)) {
            param.float_value = value;

        } else if (lodash.isArray(value)) {
            param.string_value = JSON.stringify(value);

        } else if (lodash.isObject(value)) {
            param.string_value = JSON.stringify(value);

        } else {
            param.string_value = value;
        }

        return param;
    });
}

/**
 * @param {string} options.eventName
 * @param {string[]} [options.userIds]
 * @param {Object} [options.eventParams]
 * @param {Object} [options.userProperties]
 * @return {Promise<void>}
 */
async function insert(options) {
    // Firebase Schema: https://support.google.com/firebase/answer/7029846?hl=en
    const currentDate = new Date();
    await table.insert({
        event_date: `${currentDate.getFullYear()}${currentDate.getMonth() + 1}${currentDate.getDate()}`,
        event_timestamp: currentDate.getTime() * 1000,
        event_name: options.eventName,
        event_params: _jsonToRecord(options.eventParams),
        event_value_in_usd: 0,
        user_ids: JSON.stringify(options.userIds),
        user_properties: _jsonToRecord(options.userProperties),
        server_info: _jsonToRecord({
            version: config.get('serviceDeployVersion'),
            colyseus_version: packageJson.dependencies.colyseus,
            instance: process.env.GAE_INSTANCE,
        }),
    });
}

module.exports = {
    insert,
};
