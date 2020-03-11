'use strict';

const { Schema, type } = require('@colyseus/schema');

class ItemState extends Schema {

    constructor(itemId, state) {
        super();

        /** @type {string} */
        this.itemId = itemId;

        /** @type {string} */
        this.state = state;
    }
}

type('string')(ItemState.prototype, 'itemId');
type('string')(ItemState.prototype, 'state');

module.exports = {
    ItemState,
};
