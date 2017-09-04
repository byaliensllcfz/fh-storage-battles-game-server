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
        });
        // importTest('Test name', './unit/test-file.js');
        importTest('Logging Functions Test', './unit/logger');
        importTest('Util Functions Test', './unit/util');
        importTest('Middlewares Test', './unit/middleware');
    });
    describe('Integration tests', function () {
        before(function () {
            delete require.cache[require.resolve('../models/datastore')];
            process.env.environment = "emulated";
        });
        // importTest('Test name', './integration/test-file.js');
        importTest('Datastore', './integration/datastore'); // TODO
    });
    describe('System tests', function () {
        before(function () {
            delete require.cache[require.resolve('../models/datastore')];
            process.env.environment = config.ENV;
        });
        // importTest('Test name', './system/test-file.js');
        // importTest('Datastore', './system/datastore'); // TODO
        importTest('Health Check', './system/health-check'); // TODO
    });
    // after(function () {
    //     console.log('after all tests');
    // });
});
