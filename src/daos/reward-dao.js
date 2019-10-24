'use strict';

const { config } = require('@tapps-games/core');
const requestHelper = require('../helpers/request-helper');

async function saveRewards(rewards) {
    const url = config.get('apiUrl');

    console.log('>', rewards);
    const response = await requestHelper.request({
        method: 'POST',
        url: url + '/admin/rewards',
        data: rewards,
    });

    return response.data;
}

module.exports = {
    saveRewards,
};