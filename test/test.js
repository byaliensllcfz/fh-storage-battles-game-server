'use strict';

const common = require('./common');
const config = require('../config');

process.on('unhandledRejection', ex => {
    throw ex;
});

global.baseHeaders = {
    'content-type': 'application/json',
    'x-tapps-bundle-id': 'test.bundle.id',
};

describe('Unit tests', function() {
    // common.importTest('Test name', './unit/test-file');
});
describe('Integration tests', function() {
    // common.importTest('Test name', './integration/test-file');
});
describe('System tests', function() {
    before(function(done) {
        common.systemTestSetup(config, done);
    });
    // common.importTest('Test name', './system/test-file');
    common.importTest('Health Check', './system/health-check');
});

after(common.deleteLogs);
