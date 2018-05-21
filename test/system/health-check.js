'use strict';

const chai = require('chai');
const should = chai.should();
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const common = require('../common');

let serverApp;

before(function(done) {
    serverApp = require('../../server').createApp();
    done();
});

it('should fail because the HTTP method is wrong', function(done) {
    chai.request(serverApp)
        .post('/_ah/health')
        .end(function(err, res) {
            common.errorChecks(err, res, 405);
            done();
        });
});

it('should get an OK response', function(done) {
    chai.request(serverApp)
        .get('/_ah/health')
        .end(function(err, res) {
            should.not.exist(err);
            res.should.have.status(200);
            res.text.should.equal('OK');
            done();
        });
});
