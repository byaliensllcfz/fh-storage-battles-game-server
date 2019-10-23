'use strict';

process.on('unhandledRejection', error => {
    console.log('unhandledRejection', error);
});

(async function () {
    const { createServer } = require('./server');
    await createServer();
})();
