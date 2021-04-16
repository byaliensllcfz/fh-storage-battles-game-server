'use strict';

const { config } = require('@tapps-games/core');
const requestHelper = require('../helpers/request-helper');

const { Logger } = require('@tapps-games/logging');
const logger = new Logger('config-dao');

/**
 * Get the latest configs from API.
 * @return {Promise<Config>}
 */
async function getConfigs() {
    const url = config.get('apiUrl');
    const configGroup = config.get('configGroup');

    let headers = {};
    if (configGroup) {
        headers['abtestgroup'] = configGroup;
        logger.info(`Loading configs with configGroup: ${configGroup}`);
    }

    const response = await requestHelper.request({
        method: 'GET',
        url: url + '/configs',
        headers,
    });

    return response.data;
}

module.exports = {
    getConfigs,
};
