'use strict';

const { Schema, type } = require('@colyseus/schema');

class GlobalState extends Schema {

    constructor() {
        super();

        this.status = '';
    }
}

type('string')(GlobalState.prototype, 'status');

module.exports = {
    GlobalState,
};
