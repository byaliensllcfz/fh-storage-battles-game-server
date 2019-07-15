'use strict';

const { config } = require('@tapps-games/core');
const { Datastore } = require('@tapps-games/datastore');
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
        const fileBaseName = `app-${config.get('serviceName')}-`;
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

async function assertDatastoreKey(object) {
    const datastore = new Datastore();

    const data = await datastore.read(object);

    if (data) {
        return data;

    } else {
        if (process.env.DATASTORE_EMULATOR_HOST === 'localhost:8081') {
            const uuid = require('uuid/v4');
            object.entity = {
                key: uuid(),
            };
            return datastore.write(object);

        } else {
            throw new Error(`No entity found in datastore with id: ${object.id}, in kind: ${object.kind} and namespace: ${object.namespace}.`);
        }
    }
}

async function assertSharedCloudSecret() {
    const sharedCloudSecret = await assertDatastoreKey({
        id: 'latest',
        kind: 'SharedCloudSecret',
        namespace: 'cloud-configs',
    });
    global.baseHeaders['x-tapps-shared-cloud-secret'] = sharedCloudSecret.key;
    global.sharedCloudSecret = sharedCloudSecret;
}

module.exports = {
    assertSharedCloudSecret,
    deleteLogs,
};
