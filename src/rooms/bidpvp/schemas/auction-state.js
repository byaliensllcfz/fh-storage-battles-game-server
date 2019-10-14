'use strict';

const { Schema, type } = require('@colyseus/schema');

class AuctionState extends Schema {
    constructor(options = {}) {
        super();

        /** @type {number} */
        this.bidValue = options.bidValue || 0;

        /** @type {string} */
        this.bidOwner = options.bidOwner || '';
    }
}

type('int32')(AuctionState.prototype, 'bidValue');
type('string')(AuctionState.prototype, 'bidOwner');

module.exports = {
    AuctionState,
};
