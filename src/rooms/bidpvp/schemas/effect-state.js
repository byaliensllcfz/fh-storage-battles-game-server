'use strict';

const { Schema, type } = require('@colyseus/schema');

class EffectState extends Schema {
    constructor(options = {}) {
        super();

        /** @type {string} */
        this.id = options.id || '';

        /** @type {string} */
        this.owner = options.owner || '';

        /** @type {string} */
        this.target = options.target || '';

        /** @type {string} */
        this.expiration = options.expiration || '';
    }
}

type('string')(EffectState.prototype, 'id');
type('string')(EffectState.prototype, 'owner');
type('string')(EffectState.prototype, 'target');
type('string')(EffectState.prototype, 'expiration');

module.exports = {
    EffectState,
};
