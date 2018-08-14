'use strict';

const chai = require('chai');
const should = chai.should();

const common = require('./common');
const config = require('../config');

describe('System tests', function() {

    before(async function() {
        should.not.exist(process.env.DATASTORE_EMULATOR_HOST);
        await common.assertSharedCloudSecret(config); // FIXME: TP Server Services only
        await common.assertServiceAccountKey(config); // FIXME: Game Servers only
        global.hostname = `https://${config.service_deploy_id}-dot-${process.env.GOOGLE_CLOUD_PROJECT}.appspot.com`;
    });

    describe('Health Check', require('./system/health-check-test'));
    describe('Resource Status', require('./system/resource-status-test'));
});

after(common.deleteLogs);
