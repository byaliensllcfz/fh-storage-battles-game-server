'use strict';

const { config } = require('@tapps-games/core');
const requestHelper = require('../helpers/request-helper');

/**
 * Get the latest configs from API.
 * @return {Promise<Config>}
 */
async function getConfigs() {
    const url = config.get('apiUrl');
    const response = await requestHelper.request({
        method: 'GET',
        url: url + '/configs',
    });

    return response.data;
}

module.exports = {
    getConfigs,
};
