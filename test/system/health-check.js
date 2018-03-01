'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const common = require('../common');
const server = require('../../server');

let serverApp;

before(done => {
    serverApp = server.createApp();
    done();
});

it('should fail because the HTTP method is wrong', done => {
    chai.request(serverApp)
        .post('/_ah/health')
        .end((err, res) => {
            common.errorChecks(err, res, 405);
            done();
        });
});
it('should get an OK response', done => {
    chai.request(serverApp)
        .get('/_ah/health')
        .end((err, res) => {
            if (err) {
                throw err;
            }
            res.should.have.status(200);
            res.text.should.eql('OK');
            done();
        });
});
