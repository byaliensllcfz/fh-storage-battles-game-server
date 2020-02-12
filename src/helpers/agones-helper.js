'use strict';

const { config } = require('@tapps-games/core');
const AgonesSDK = require('@googleforgames/agones');

let agonesSDK;
let ignoreAgones = true;

async function connectToAgones() {
    ignoreAgones = config.get('ignoreAgones', false);

    if (!ignoreAgones) {
        agonesSDK = new AgonesSDK();
        await agonesSDK.connect();
    }
}

function setUpHealthCheck(app, utils) {
    if (!ignoreAgones) {
        app.get('/liveness-check', utils.asyncRoute(async (_req, res) => {
            agonesSDK.health();
            res.send('ok');
        }));
    }
}

async function sendAgonesReady() {
    if (!ignoreAgones) {
        await agonesSDK.ready();
    }
}

module.exports = {
    connectToAgones,
    setUpHealthCheck,
    sendAgonesReady,
};
