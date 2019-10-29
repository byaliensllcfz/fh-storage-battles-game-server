'use strict';

const { Schema, type, MapSchema, ArraySchema } = require('@colyseus/schema');

const { PlayerState } = require('./player-state');
const { LotState } = require('./lot-state');

class GlobalState extends Schema {

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

type('string')(GlobalState.prototype, 'status');
type([LotState])(GlobalState.prototype, 'lots');
type({map: PlayerState})(GlobalState.prototype, 'players');
type('uint8')(GlobalState.prototype, 'currentLot');

module.exports = {
    GlobalState,
};
