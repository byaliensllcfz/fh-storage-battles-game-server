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
    describe(name, function () {
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
    }).then(function (result) {
        global.baseHeaders['x-tapps-shared-cloud-secret'] = result.key;
        done();
    }).catch(function () {
        const uuid = require('uuid/v4');
        const key = uuid();
        let date = new Date().getTime();
        date += (1 * 60 * 60 * 1000);
        datastore.write({
            id: 'latest',
            kind: 'SharedCloudSecret',
            namespace: 'cloud-configs',
            data: {
                expiration: new Date(date).valueOf(),
                key: key
            }
        }).then(function () {
            global.baseHeaders['x-tapps-shared-cloud-secret'] = key;
            done();
        }).catch(function (error) {
            throw error;
        });
    });
}

describe('Service Name Tests', function () {
    describe('Unit tests', function () {
        // importTest('Test name', './unit/test-file');
    });
    describe('Integration tests', function () {
        // importTest('Test name', './integration/test-file');
    });
    describe('System tests', function () {
        before(function (done) {
            systemTestSetup(done);
        });
        // importTest('Test name', './system/test-file');
        importTest('Health Check', './system/health-check');
    });
    after(function () {
        // Remove any leftover logs
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.NAME + '-notice.json',
            ''
        );
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.NAME + '-info.json',
            ''
        );
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.NAME + '-error.json',
            ''
        );
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.NAME + '-alert.json',
            ''
        );
    });
});
