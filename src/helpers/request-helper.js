'use strict';

const { config, TappsHeaders } = require('@by-aliens-tooling/core');
const { tpServerRequest } = require('@by-aliens-tooling/requests');

const uuid = require('uuid/v4');

/**
 * Makes a request to a TP Server API, adding the necessary headers.
 *
 * @param  {Object} options
 * @return {Promise<Object>}
 */
async function request(options) {
    options.headers = options.headers || {};
    options.headers[TappsHeaders.BUNDLE_ID] = config.get('bundleId');
    options.headers[TappsHeaders.SERVICE_ACCOUNT_NAME] = config.get('serviceName');
    options.headers[TappsHeaders.TRANSACTION_ID] = `${config.get('serviceName')}-${uuid()}`;

    return tpServerRequest(options);
}

module.exports = {
    request,
};
