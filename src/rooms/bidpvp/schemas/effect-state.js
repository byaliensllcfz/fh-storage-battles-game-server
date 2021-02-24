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

        /** @type {int64} */
        this.expiration = options.expiration || 0;

        /** @type {int32} */
        this.valueInt = options.valueInt || 0;
    }
}

type('string')(EffectState.prototype, 'id');
type('string')(EffectState.prototype, 'owner');
type('string')(EffectState.prototype, 'target');
type('int64')(EffectState.prototype, 'expiration');
type('int32')(EffectState.prototype, 'valueInt');

module.exports = {
    EffectState,
};
