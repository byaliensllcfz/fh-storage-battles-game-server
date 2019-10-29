'use strict';

const { Schema, MapSchema, type } = require('@colyseus/schema');

class AuctionState extends Schema {
    constructor(options = {}) {
        super();

        /** @type {number} */
        this.bidValue = options.bidValue || 0;

        /** @type {string} */
        this.bidOwner = options.bidOwner || '';

        /** @type {number} */
        this.dole = 0;

        /** @type {Object<string, string>} */
        this.items = new MapSchema();

        /** @type {number} */
        this.randomSeed;

        /** @type {string} */
        this.status = 'WAITING';
    }
}

type('int32')(AuctionState.prototype, 'bidValue');
type('string')(AuctionState.prototype, 'bidOwner');
type('int8')(AuctionState.prototype, 'dole');
type({map: 'string'})(AuctionState.prototype, 'items');
type('int32')(AuctionState.prototype, 'randomSeed');
type('string')(AuctionState.prototype, 'status');

module.exports = {
    AuctionState,
};
