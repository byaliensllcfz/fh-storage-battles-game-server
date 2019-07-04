'use strict';

const lodash = require('lodash');
const { ErrorDefinition, HttpStatus, TappsErrors } = require('@tapps-games/core');

const ApplicationErrors = lodash.assign({}, TappsErrors, {
    // MY_ERROR: new ErrorDefinition(HttpStatus.[code], [type], [message]),
});

module.exports = {
    ApplicationErrors,
};
