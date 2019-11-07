'use strict';

// The Datadog require has to be the first thing to run!
require('@tapps-games/datadog');

process.on('unhandledRejection', error => {
    console.log('unhandledRejection', error);
});

(async function () {
    const { config } = require('@tapps-games/core');
    await config.load('env');
    await config.load('json', 'config.json');

    const { createServer } = require('./server');
    await createServer();
})();
