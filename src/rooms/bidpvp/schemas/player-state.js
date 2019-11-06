'use strict';

const { Schema, type } = require('@colyseus/schema');

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

module.exports = {
    PlayerState,
};
