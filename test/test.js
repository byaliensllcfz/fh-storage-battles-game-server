'use strict';

const fs = require('fs');

const config = require('../config');

global.baseHeaders = {
    'content-type': 'application/json',
    'x-tapps-bundle-id': 'test.bundle.id'
};

function importTest(name, path) {
    describe(name, function () {
        require(path);
    });
}

describe('Service Name Tests', function () {
    describe('Unit tests', function () {
        // importTest('Test name', './unit/test-file');
        importTest('Logging Functions', './unit/logger');
        importTest('Util Functions', './unit/util');
        importTest('Middlewares', './unit/middleware');
        importTest('Datastore', './unit/datastore');
    });
    describe('Integration tests', function () {
        // importTest('Test name', './integration/test-file');
        importTest('Datastore', './integration/datastore');
    });
    describe('System tests', function () {
        before(function(done) {
            // Read the Shared Cloud Secret from Datastore
            const Datastore = require('../models/datastore');
            const datastore = new Datastore();
            datastore.read({
                'id': 'latest',
                'kind': 'SharedCloudSecret',
                'namespace': 'cloud-configs',
                'callback': function(err, data) {
                    if (err) {
                        const uuid = require('uuid/v4');
                        const key = uuid();
                        const date = new Date().getTime();
                        date += (1 * 60 * 60 * 1000);
                        datastore.write({
                            'id': 'latest',
                            'kind': 'SharedCloudSecret',
                            'namespace': 'cloud-configs',
                            'data': {
                                'expiration': new Date(date).valueOf(),
                                'key': key
                            },
                            'callback': function(err, data) {
                                if (err) {
                                    throw err;
                                }
                                global.baseHeaders['x-tapps-shared-cloud-secret'] = key;
                                done();
                            }
                        });
                    } else {
                        global.baseHeaders['x-tapps-shared-cloud-secret'] = data.key;
                        done();
                    }
                }
            });
        });
        // importTest('Test name', './system/test-file');
        importTest('Health Check', './system/health-check');
    });
    after(function() {
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
            '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-error.json',
            ''
        );
        fs.writeFileSync(
            '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-alert.json',
            ''
        );
    });
});
