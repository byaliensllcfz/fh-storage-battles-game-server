'use strict';

require('dotenv').config({ path: 'test/config/.env' });

const { config } = require('@by-aliens-tooling/core');

require('@by-aliens-tooling/test');

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
    await config.load('json', 'test/config/config.json');
    config.set('loggingEnableFiles', false);
    config.set('loggingEnableConsole', false);

    expect(process.env.DATASTORE_EMULATOR_HOST).to.be.equal('localhost:8081');
});
