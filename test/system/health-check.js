'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const common = require('../common');
const server = require('../../server');

it('should fail because the HTTP method is wrong', function (done) {
    chai.request(server)
        .post('/_ah/health')
        .end(function (err, res) {
            common.errorChecks(err, res, 405);
            done();
        });
});
it('should get an OK response', function (done) {
    chai.request(server)
        .get('/_ah/health')
        .end(function (err, res) {
            if (err) {
                throw err;
            }
            res.should.have.status(200);
            res.text.should.eql('OK');
            done();
        });
});
