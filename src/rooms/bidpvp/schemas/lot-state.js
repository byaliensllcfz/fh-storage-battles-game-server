'use strict';

const { Schema, MapSchema, type } = require('@colyseus/schema');

const { auctionStatus } = require('../../../types');
const { BoxState } = require('./box-state');

class LotState extends Schema {

    constructor(options = {}) {
        super();

        /** @type {number} */
        this.bidValue = options.bidValue || 0;

        /** @type {number} */
        this.nextBidValue = 0;

        /** @type {string} */
        this.bidOwner = options.bidOwner || '';

        /** @type {number} */
        this.dole = 0;

        /** @type {Object<string, string>} */
        this.items = new MapSchema();

        /** @type {Object<string, BoxState>} */
        this.boxes = new MapSchema();

        /** @type {Object<string, string>} */
        this.boxedItems = {};

        /** @type {number} */
        this.randomSeed;

        /** @type {string} */
        this.status = auctionStatus.WAITING;

        /** @type {number} */
        this.lotItemsPrice = 0;
    }
}

type('int32')(LotState.prototype, 'bidValue');
type('int32')(LotState.prototype, 'nextBidValue');
type('string')(LotState.prototype, 'bidOwner');
type('int8')(LotState.prototype, 'dole');
type({ map: 'string' })(LotState.prototype, 'items');
type({ map: BoxState })(LotState.prototype, 'boxes');
type('int32')(LotState.prototype, 'randomSeed');
type('string')(LotState.prototype, 'status');
type('int32')(LotState.prototype, 'lotItemsPrice');

module.exports = {
    LotState,
};
