'use strict';

const config = require('../config');
const fs = require('fs');

global.baseHeaders = {
    'content-type': 'application/json',
    'x-tapps-bundle-id': 'test.bundle.id',
};

process.on('unhandledRejection', ex => {
    throw ex;
});

function deleteLogs(done) {
    const path = '/var/log/app_engine/custom_logs/';
    fs.readdir(path, (error, files) => {
        if (error) {
            done(error);
        }
        const fileBaseName = `app-${config.service_name}-`;
        const matcher = new RegExp(fileBaseName + '.*');
        const matchedFiles = files.filter(name => matcher.test(name));
        matchedFiles.forEach(filename => {
            fs.unlink(path + filename, err => {
                error = err;
            });
        });
        done(error);
    });
}

async function assertDatastoreKey(config, object) {
    const tpCommon = require('tp-common');
    const datastore = new tpCommon.Datastore(config);
    try {
        return await datastore.read(object);
    } catch (error) {
        if (process.env.DATASTORE_EMULATOR_HOST === 'localhost:8081') {
            const uuid = require('uuid/v4');
            object.data = {
                key: uuid(),
            };
            return await datastore.write(object);
        } else {
            throw error;
        }
    }
}

async function assertSharedCloudSecret(config) {
    const sharedCloudSecret = await assertDatastoreKey(config, {
        id: 'latest',
        kind: 'SharedCloudSecret',
        namespace: 'cloud-configs',
    });
    global.baseHeaders['x-tapps-shared-cloud-secret'] = sharedCloudSecret.key;
    global.sharedCloudSecret = sharedCloudSecret;
}

async function assertServiceAccountKey(config) {
    const serviceAccountKey = await assertDatastoreKey(config, {
        id: config.service_name,
        kind: 'ServiceAccountKeys',
        namespace: 'cloud-configs',
    });
    global.baseHeaders['x-tapps-service-account-key'] = serviceAccountKey.key;
    global.serviceAccountKey = serviceAccountKey;
}

module.exports = {
    assertServiceAccountKey,
    assertSharedCloudSecret,
    deleteLogs,
};
