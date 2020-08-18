'use strict';

const { config, TappsHeaders } = require('@tapps-games/core');
const { tpServerRequest } = require('@tapps-games/requests');

const uuid = require('uuid/v4');

/** @ignore */
const secretHelper = require('./secret-helper');

/**
 * Makes a request to a TP Server API, adding the necessary headers.
 *
 * @param  {Object} options
 * @return {Promise<Object>}
 */
async function request(options) {
    const secret = await secretHelper.get();
    options.headers = options.headers || {};
    options.headers[TappsHeaders.SHARED_CLOUD_SECRET] = secret.key;
    options.headers[TappsHeaders.BUNDLE_ID] = config.get('bundleId');
    options.headers[TappsHeaders.SERVICE_ACCOUNT_NAME] = config.get('serviceName');
    options.headers[TappsHeaders.TRANSACTION_ID] = `${config.get('serviceName')}-${uuid()}`;

    return tpServerRequest(options);
}

module.exports = {
    request,
};
