'use strict';

const { Schema, type } = require('@colyseus/schema');

class PlayerState extends Schema {
    constructor(options = {}) {
        super();

        /** @type {string} */
        this.id = options.id || '';

        /** @type {number} */
        this.money = options.money || 0;
    }
}

type('string')(PlayerState.prototype, 'id');
type('int32')(PlayerState.prototype, 'money');

module.exports = {
    PlayerState,
};
