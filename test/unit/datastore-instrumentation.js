'use strict';

const newrelic = require('newrelic');
const chai = require('chai');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);
chai.should();

let instrumentation = require('../../datastore-instrumentation');

it('should instrument all datastore functions', function() {
    newrelic.instrumentDatastore('@google-cloud/datastore', instrumentation);
    let datastore = require('@google-cloud/datastore');
    datastore.should.have.property('__NR_instrumented');
});
