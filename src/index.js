'use strict';

// The Datadog require has to be the first thing to run!
require('@tapps-games/datadog');

const { createServer } = require('./server');

(async function () {
    const server = await createServer();

    server.start();
})();
