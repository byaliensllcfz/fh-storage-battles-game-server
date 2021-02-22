'use strict';

const { Schema, MapSchema, type } = require('@colyseus/schema');

const { PowerState } = require('./power-state');
const { EffectState } = require('./effect-state');

class PlayerState extends Schema {
    constructor(options = {}) {
        super();

        /** @type {string} */
        this.firebaseId = options.firebaseId || '';

        /** @type {string} */
        this.id = options.id || '';

        /** @type {string} */
        this.name = options.name || '';

        /** @type {string} */
        this.photoUrl = options.photoUrl || '';

        /** @type {number} */
        this.money = options.money || 0;

        /** @type {number} */
        this.lastBid;

        /** @type {string} */
        this.character = options.character || '';

        /** @type {boolean} */
        this.connected = true;

        /** @type {number} */
        this.trophiesEarned;

        /** @type {boolean} */
        this.isBot = options.isBot || false;

        /** @type {number} */
        this.trophies = 0;

        /** @type {number} */
        this.rank = 0;

        /** @type {number} */
        this.interruptions = 0;

        /** @type {number} */
        this.reconnections = 0;

        /** @type {string} */
        this.abtestgroup = options.abtestgroup || '';

        /** @type {Object<string, PowerState} */
        this.powers = new MapSchema();

        /** @type {Object<string, EffectState>} */
        this.effects = new MapSchema();
    }
}

type('string')(PlayerState.prototype, 'id');
type('string')(PlayerState.prototype, 'name');
type('string')(PlayerState.prototype, 'photoUrl');
type('int32')(PlayerState.prototype, 'money');
type('int32')(PlayerState.prototype, 'lastBid');
type('string')(PlayerState.prototype, 'character');
type('boolean')(PlayerState.prototype, 'connected');
type('int32')(PlayerState.prototype, 'trophiesEarned');
type('int32')(PlayerState.prototype, 'trophies');
type('int8')(PlayerState.prototype, 'rank');
type({ map: PowerState })(PlayerState.prototype, 'powers');
type({ map: EffectState })(PlayerState.prototype, 'effects');

module.exports = {
    PlayerState,
};
