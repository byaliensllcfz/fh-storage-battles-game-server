'use strict';

const chai = require('chai');
const { assertions } = require('@tapps-games/test');

const { createServer } = require('../../src/server');

let server, serverApp;

describe('Integration Test - Resource Status', function () {

    before(async function () {
        server = await createServer();
        serverApp = server.app;
        server._startChild();
    });

    after(function () {
        server.server.close();
    });

    it('should fail because the HTTP method is wrong', async function () {
        const res = await chai.request(serverApp)
            .post('/resource-status');

        assertions.errorChecks(res, 403);
    });

    it('should get the server version', async function () {
        const { config } = require('@tapps-games/core');

        const res = await chai.request(serverApp)
            .get('/resource-status');

        assertions.successChecks(res, 200);
        expect(res.body).to.be.an('object');
        expect(res.body.name).to.be.equal(config.get('serviceName'));
        expect(res.body.env).to.be.equal(config.get('env'));
        expect(res.body.version).to.be.equal(config.get('serviceDeployVersion'));
    });
});
