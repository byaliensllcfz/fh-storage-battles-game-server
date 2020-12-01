'use strict';

const { config } = require('@tapps-games/core');
const AgonesSDK = require('@google-cloud/agones-sdk');

let agonesSDK;
let ignoreAgones = true;

//TODO remove agones flag when its all up and running
async function connectToAgones() {
    ignoreAgones = config.get('ignoreAgones', false);

    if (!ignoreAgones) {
        agonesSDK = new AgonesSDK();
        await agonesSDK.connect();
    }
}

function setUpHealthCheck(app, utils) {
    app.get('/liveness-check', utils.asyncRoute(async (_req, res) => {
        if (!ignoreAgones) {
            agonesSDK.health();
        }
        res.send('ok');
    }));
}

async function sendAgonesReady() {
    if (!ignoreAgones) {
        await agonesSDK.ready();
    }
}

function setUpDeallocateEndpoint(app, utils) {
    if (!ignoreAgones) {
        app.get('/admin/deallocate', utils.asyncRoute(async (req, res) => {
            const seconds = req.query.seconds || 420; // 7 minutes
            agonesSDK.reseve(seconds);
            res.send(`Deallocating server in ${seconds} seconds`);
        }));
    }
}

module.exports = {
    connectToAgones,
    setUpHealthCheck,
    sendAgonesReady,
    setUpDeallocateEndpoint,
};
