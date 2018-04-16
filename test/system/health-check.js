'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const common = require('../common');
const server = require('../../server');

let serverApp;

before(function(done) {
    serverApp = server.createApp();
    done();
});

it('should fail because the HTTP method is wrong', function(done) {
    chai.request(serverApp)
        .post('/_ah/health')
        .end((err, res) => {
            common.errorChecks(err, res, 405);
            done();
        });
});
it('should get an OK response', function(done) {
    chai.request(serverApp)
        .get('/_ah/health')
        .end((err, res) => {
            if (err) {
                done(err);
            }
            common.successChecks(err, res, 200);
            res.body.should.be.an('object');
            done();
        });
});
