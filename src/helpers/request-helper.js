'use strict';

const { config, TappsHeaders } = require('@tapps-games/core');
const { tpServerRequest } = require('@tapps-games/requests');

/** @ignore */
const secretHelper = require('./secret-helper');

/**
 * Calls the ads config server to retrieve the list of configs
 *
 * @param  {string} bundleId
 * @param  {string} geolocation
 * @param  {number} version
 * @param  {string} store
 *
 * @return {Promise<AdsConfig[]>}
 */
async function request(options) {
    const secret = await secretHelper.get();
    options.headers = options.headers || {};
    options.headers[TappsHeaders.SHARED_CLOUD_SECRET] = secret.key;
    options.headers[TappsHeaders.BUNDLE_ID] = config.get('bundleId');
    options.headers[TappsHeaders.SERVICE_ACCOUNT_NAME] = config.get('serviceName');

    return tpServerRequest(options);
}

module.exports = {
    request,
};
