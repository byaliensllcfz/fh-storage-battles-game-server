'use strict';

const newrelic = require('newrelic');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const sinonStubPromise = require('sinon-stub-promise');
const should = chai.should();
chai.use(sinonChai);
sinonStubPromise(sinon);

let instrumentation = require('../../datastore-instrumentation');

it('should instrument all datastore functions', function (done) {
    newrelic.instrumentDatastore('@google-cloud/datastore', instrumentation);
    let datastore = require('@google-cloud/datastore');
    datastore.should.have.property('__NR_instrumented');
    done();
});
