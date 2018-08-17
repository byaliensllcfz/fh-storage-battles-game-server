'use strict';

const common = require('./common');
const config = require('../config');

describe('System tests', function() {

    before(async function() {
        delete process.env.DATASTORE_EMULATOR_HOST;
        delete process.env.DATASTORE_PROJECT_ID;
        global.hostname = `https://${config.service_deploy_id}-dot-${config.gcloud_project}.appspot.com`;

        await common.assertSharedCloudSecret(config); // FIXME: TP Server Services only
        await common.assertServiceAccountKey(config); // FIXME: Game Servers only
    });

    describe('Health Check', require('./system/health-check-test'));
    describe('Resource Status', require('./system/resource-status-test'));
});

after(common.deleteLogs);
