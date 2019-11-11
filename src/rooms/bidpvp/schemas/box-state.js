'use strict';

const { Schema, type } = require('@colyseus/schema');

class BoxState extends Schema {

    constructor(boxId) {
        super();

        /** @type {string} */
        this.boxId = boxId;

        /** @type {string} */
        this.itemId;
    }
}

type('string')(BoxState.prototype, 'boxId');
type('string')(BoxState.prototype, 'itemId');

module.exports = {
    BoxState,
};
