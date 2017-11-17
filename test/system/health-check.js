'use strict';

const request = require('supertest');

const common = require('../common');
const server = require('../../server');

it('should fail becuse the HTTP method is wrong', function(done) {
    request(server)
        .post('/_ah/health')
        .expect('Content-Type', 'application/problem+json; charset=utf-8')
        .expect(405, function(err, res) {
            common.errorChecks(err, res);
            done();
        });
});
it('should get an OK response', function(done) {
    request(server)
        .get('/_ah/health')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200, function(err, res) {
            if (err) {
                throw err;
            }
            res.text.should.eql('OK');
            done();
        });
});