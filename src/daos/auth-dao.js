'use strict';

const { config } = require('@tapps-games/core');
const requestHelper = require('../helpers/request-helper');

async function validateToken(token) {
    const url = config.get('https://auth-v3-dot-tpserver-dev-env.appspot.com/users/me');
    const response = await requestHelper.request({
        method: 'GET',
        url,
        headers: {
            'x-tapps-game-user-id-token': token,
        },
    });

    return response.data;
}

module.exports = {
    validateToken,
};