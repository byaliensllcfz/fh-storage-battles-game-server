'use strict';

const { Schema, type } = require('@colyseus/schema');

class PowerState extends Schema {
    constructor(options = {}) {
        super();

        /** @type {string} */
        this.id = options.id || '';

        /** @type {string} */
        this.expiration = options.expiration || '';
    }
}

type('string')(PowerState.prototype, 'id');
type('string')(PowerState.prototype, 'expiration');

module.exports = {
    PowerState,
};
