'use strict';

const chai = require('chai');
const { assertions } = require('@tapps-games/test');

const { createServer } = require('../../src/server');

let server, serverApp;

describe('Integration Test - Health Check', function () {

    before(async function () {
        server = await createServer();
        serverApp = server.app;
        server._startChild();
    });

    after(function () {
        server.server.close();
    });

    describe('Liveness Check', function () {
        it('should fail because the HTTP method is wrong', async function () {
            const res = await chai.request(serverApp)
                .post('/liveness-check');

            assertions.errorChecks(res, 403);
        });

        it('should get an OK response', async function () {
            const res = await chai.request(serverApp)
                .get('/liveness-check');

            assertions.successChecks(res, 200);
            expect(res.body).to.be.an('object');
        });
    });

    describe('Readiness Check', function () {
        it('should fail because the HTTP method is wrong', async function () {
            const res = await chai.request(serverApp)
                .post('/readiness-check');

            assertions.errorChecks(res, 403);
        });

        it('should get an OK response', async function () {
            const res = await chai.request(serverApp)
                .get('/readiness-check');

            assertions.successChecks(res, 200);
            expect(res.body).to.be.an('object');
        });
    });
});
