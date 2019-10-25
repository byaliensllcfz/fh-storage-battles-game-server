'use strict';

/** @ignore */
let _config = null;

/**
 * @param {Object<string, string>} config
 */
function set(config) {
    _config = config;
}

/**
 * @returns {Object<string, string>}
 */
function get() {
    return _config;
}

module.exports = {
    set,
    get,
};