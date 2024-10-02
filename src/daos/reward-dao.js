'use strict';

const { config } = require('@by-aliens-tooling/core');
const requestHelper = require('../helpers/request-helper');

async function saveRewards(rewards) {
    const url = config.get('apiUrl');

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