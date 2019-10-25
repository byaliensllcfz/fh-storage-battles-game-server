'use strict';

const { Repository, models } = require('@tapps-games/datastore');
const { SharedCloudSecret } = models;

const secretRepository = new Repository(SharedCloudSecret);

/** @type {SharedCloudSecret} */
let secretCache = null;

/**
 * @returns {SharedCloudSecret}
 */
async function get() {
    if (!secretCache || secretCache.isExpired()) {
        secretCache = await secretRepository.get({ id: SharedCloudSecret.LATEST });
    }

    return secretCache;
}

module.exports = {
    get,
};