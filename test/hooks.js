'use strict';

require('dotenv').config({ path: 'configs/test/.env' });

const { config } = require('@tapps-games/core');

require('@tapps-games/test');

const common = require('./common');

/**
 * Define mocha hooks here:
 *
 *  before
 *  beforeEach
 *  after
 *  afterEach
 */

before(async function () {
    await config.load('env');
    await config.load('json', 'configs/test/config.json');
    config.set('loggingEnableConsole', false);

    expect(process.env.DATASTORE_EMULATOR_HOST).to.be.equal('localhost:8081');
    //await common.assertSharedCloudSecret(config);
});

after(common.deleteLogs);
