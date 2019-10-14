'use strict';

const { Schema, type } = require('@colyseus/schema');

class AuctionState extends Schema {
    constructor(options = {}) {
        super();

        /** @type {number} */
        this.bidValue = options.bidValue || 0;

        /** @type {string} */
        this.bidOwner = options.bidOwner || '';

        /** @type {number} */
        this.dole = 0;
    }
}

type('int32')(AuctionState.prototype, 'bidValue');
type('string')(AuctionState.prototype, 'bidOwner');
type('int8')(AuctionState.prototype, 'dole');

module.exports = {
    AuctionState,
};
