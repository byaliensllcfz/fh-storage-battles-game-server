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
        before(function () {
            process.env.environment = "emulated";
            delete require.cache[require.resolve('../../models/datastore')];
        });
        // importTest('Test name', './unit/test-file.js');
        importTest('Util Functions Test', './unit/util');
        importTest('Middlewares Test', './unit/middleware'); // TODO
        importTest('Datastore with Emulator', './unit/datastore'); // TODO
    });
    describe('Integration tests', function () {
        before(function () {
            process.env.environment = "emulated";
            delete require.cache[require.resolve('../../models/datastore')];
        });
        // importTest('Test name', './integration/test-file.js');
        importTest('Datastore', './integration/datastore'); // TODO
    });
    describe('System tests', function () {
        before(function () {
            process.env.environment = config.ENV;
            delete require.cache[require.resolve('../../models/datastore')];
        });
        // importTest('Test name', './system/test-file.js');
        // importTest('Datastore', './system/datastore'); // TODO
        importTest('Health Check', './system/health-check'); // TODO
    });
    // after(function () {
    //     console.log('after all tests');
    // });
});
