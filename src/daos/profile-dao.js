'use strict';

const { config } = require('@by-aliens-tooling/core');
const requestHelper = require('../helpers/request-helper');

async function getProfiles(ids) {
    const url = config.get('apiUrl');
    const response = await requestHelper.request({
        method: 'GET',
        url: url + '/admin/profiles',
        params: {
            ids,
        },
    });

    return response.data;
}

module.exports = {
    getProfiles,
};