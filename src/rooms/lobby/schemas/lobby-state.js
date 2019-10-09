'use strict';

const { Schema, type } = require('@colyseus/schema');

class LobbyState extends Schema {

    constructor() {
        super();

        this.message = '';
    }
}

type('string')(LobbyState.prototype, 'message');

module.exports = {
    LobbyState,
};
