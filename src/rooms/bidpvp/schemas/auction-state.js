'use strict';

const { Schema, type, MapSchema, ArraySchema } = require('@colyseus/schema');

const { PlayerState } = require('./player-state');
const { LotState } = require('./lot-state');

class AuctionState extends Schema {

    constructor() {
        super();

        this.status = 'WAITING';

        /** @type {Object<string, PlayerState>} */
        this.players = new MapSchema();

        /** @type {Array<LotState>} */
        this.lots = new ArraySchema();

        /**@type {number} */
        this.currentLot = 0;
    }
}

type('string')(AuctionState.prototype, 'status');
type([LotState])(AuctionState.prototype, 'lots');
type({map: PlayerState})(AuctionState.prototype, 'players');
type('uint8')(AuctionState.prototype, 'currentLot');

module.exports = {
    AuctionState,
};
