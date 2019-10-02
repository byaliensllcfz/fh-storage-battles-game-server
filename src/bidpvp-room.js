'use strict';

const { Room } = require('colyseus');
const { GlobalState } = require('./schemas/global-state');

class BidPvpRoom extends Room {
    onCreate (options) {
        console.log(`Room Init ${JSON.stringify(options)} - ${this.roomId}`);

        this.setState(new GlobalState());
        this.setPatchRate(1000 / 20);

        /** @type {number} */
        this.maxClients = 2;
    }

    onJoin (client, options) {
        console.log(`Client: ${client} joined. ${JSON.stringify(options)}`);

    }

    onMessage (client, message) {
        console.log(`Client: ${client.id} sent message ${JSON.stringify(message)}`);
    }

    onLeave (client, consented) {
        console.log(`Client: ${client} left. consented? ${consented}`);
    }

    onDispose () {

    }
}

module.exports = BidPvpRoom;