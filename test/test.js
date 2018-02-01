'use strict';

const fs = require('fs');

const config = require('../config');

global.baseHeaders = {
    'content-type': 'application/json',
    'x-tapps-bundle-id': 'test.bundle.id'
};

process.on('unhandledRejection', ex => {
    throw ex;
});

function importTest (name, path) {
    describe(name, () => {
        require(path);
    });
}

function systemTestSetup (done) {
    // Read the Shared Cloud Secret from Datastore
    const Datastore = require('tp-common/datastore');
    const datastore = new Datastore(config);
    datastore.read({
        id: 'latest',
        kind: 'SharedCloudSecret',
        namespace: 'cloud-configs'
    }).then(result => {
        global.baseHeaders['x-tapps-shared-cloud-secret'] = result.key;
        done();
    }).catch(() => {
        const uuid = require('uuid/v4');
        const key = uuid();
        let date = new Date().getTime();
        date += (1 * 60 * 60 * 1000);
        datastore.write({
            id: 'latest',
            kind: 'SharedCloudSecret',
            namespace: 'cloud-configs',
            data: {
                expiration: new Date(date).getTime(),
                key: key
            }
        }).then(() => {
            global.baseHeaders['x-tapps-shared-cloud-secret'] = key;
            done();
        }).catch(error => {
            throw error;
        });
    });
}

describe('Service Name Tests', () => {
    describe('Unit tests', () => {
        // importTest('Test name', './unit/test-file');
        importTest('Datastore Instrumentation', './unit/datastore-instrumentation');
    });
    describe('Integration tests', () => {
        // importTest('Test name', './integration/test-file');
    });
    describe('System tests', () => {
        before(done => {
            systemTestSetup(done);
        });
        // importTest('Test name', './system/test-file');
        importTest('Health Check', './system/health-check');
    });
    after(() => {
        // Remove any leftover logs
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.service_name + '-notice.json',
            ''
        );
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.service_name + '-info.json',
            ''
        );
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.service_name + '-error.json',
            ''
        );
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.service_name + '-alert.json',
            ''
        );
    });
});
