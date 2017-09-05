'use strict';

const chai    = require('chai');
const request = require('supertest');
const expect  = chai.expect;
const should  = chai.should();

const common = require('./common');
const config = require('../config');

global.baseHeaders = {
    'Content-Type': 'application/json',
    'X-Tapps-Bundle-Id': 'br.com.tapps.toiletman'
};

function importTest(name, path) {
    describe(name, function () {
        require(path);
    });
}

describe('Service Name Tests', function () {
    describe('Unit tests', function () {
        // importTest('Test name', './unit/test-file');
        importTest('Logging Functions Test', './unit/logger');
        importTest('Util Functions Test', './unit/util');
        importTest('Middlewares Test', './unit/middleware');
    });
    describe('Integration tests', function () {
        // importTest('Test name', './integration/test-file');
        importTest('Datastore', './integration/datastore');
    });
    describe('System tests', function () {
        before(function(done) {
            // Read the Shared Cloud Secret from Datastore
            const datastore = require('../../models/datastore');
            datastore.read({
                'id': 'latest',
                'kind': 'SharedCloudSecret',
                'namespace': 'cloud-configs',
                'callback': function(err, data) {
                    if (!err) {
                        global.baseHeaders['X-Tapps-Shared-Cloud-Secret'] = data.key;
                        done();
                    }
                }
            });
        });
        // importTest('Test name', './system/test-file');
        importTest('Health Check', './system/health-check');
    });
    // after(function () {
    //     console.log('after all tests');
    // });
});
