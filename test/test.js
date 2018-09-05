'use strict';

const common = require('./common');
const config = require('../config');

describe('Unit tests', function () {
    // describe('Test Name (/path/to/file/being/tested.js)', require('./path/to/test/file'));
});

describe('Integration tests', function () {

    before(async function () {
        process.env.DATASTORE_EMULATOR_HOST.should.be.equal('localhost:8081');
        await common.assertSharedCloudSecret(config); // FIXME: TP Server Services only
        await common.assertServiceAccountKey(config); // FIXME: Game Servers only
    });

    // describe('Test Name', require('./path/to/test/file'));
});

after(common.deleteLogs);
