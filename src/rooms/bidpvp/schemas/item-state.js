'use strict';

const { Schema, type } = require('@colyseus/schema');

class ItemState extends Schema {

    constructor(options = {}) {
        super();

        /** @type {string} */
        this.itemId = options.itemId;

        /** @type {string} */
        this.state = options.state;
    }
}

type('string')(ItemState.prototype, 'itemId');
type('string')(ItemState.prototype, 'state');

module.exports = {
    ItemState,
};
