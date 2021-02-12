'use strict';

const { Schema, type } = require('@colyseus/schema');

class PowerState extends Schema {
    constructor(options = {}) {
        super();

        /** @type {string} */
        this.id = options.id || '';

        /** @type {int64} */
        this.expiration = options.expiration || 0;
    }
}

type('string')(PowerState.prototype, 'id');
type('int64')(PowerState.prototype, 'expiration');

module.exports = {
    PowerState,
};
