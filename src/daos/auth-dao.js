'use strict';

const requestHelper = require('../helpers/request-helper');

async function validateToken(token) {
    const url = 'http://auth.auth-dev.svc.cluster.local/users/me';
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