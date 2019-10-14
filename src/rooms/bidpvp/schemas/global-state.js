'use strict';

const { Schema, type, MapSchema } = require('@colyseus/schema');

const { PlayerState } = require('./player-state');
const { AuctionState } = require('./auction-state');

class GlobalState extends Schema {

    constructor() {
        super();

        this.status = 'WAITING';

        /** @type {Object<string, PlayerState>} */
        this.players = new MapSchema();

        /** @type {AuctionState} */
        this.auction = new AuctionState();
    }
}

type('string')(GlobalState.prototype, 'status');
type(AuctionState)(GlobalState.prototype, 'auction');
type({map: PlayerState})(GlobalState.prototype, 'players');


module.exports = {
    GlobalState,
};
