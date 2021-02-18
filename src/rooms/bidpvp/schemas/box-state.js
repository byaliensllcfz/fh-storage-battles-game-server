'use strict';

const { Schema, type } = require('@colyseus/schema');

class BoxState extends Schema {

    constructor(options = {}) {
        super();

        /** @type {string} */
        this.boxId = options.boxId;

        /** @type {string} */
        this.itemId;

        /** @type {string} */
        this.state;
    }
}

type('string')(BoxState.prototype, 'boxId');
type('string')(BoxState.prototype, 'itemId');
type('string')(BoxState.prototype, 'state');

module.exports = {
    BoxState,
};
