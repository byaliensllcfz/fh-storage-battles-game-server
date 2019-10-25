'use strict';

const lodash = require('lodash');
const { TappsErrors } = require('@tapps-games/core');

module.exports = lodash.assign({}, TappsErrors, {
    // MY_ERROR: new ErrorDefinition(HttpStatus.[code], [type], [message]),
});
