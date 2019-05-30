'use strict';

require('@tapps/test');
const common = require('./common');
const config = require('../config/dev/config');

/**
 * Define mocha hooks here:
 *
 *  before
 *  beforeEach
 *  after
 *  afterEach
 */

before(async function () {
    expect(process.env.DATASTORE_EMULATOR_HOST).to.be.equal('localhost:8081');
    await common.assertSharedCloudSecret(config); // FIXME: TP Server Services only
    await common.assertServiceAccountKey(config); // FIXME: Game Servers only
});

after(common.deleteLogs);
