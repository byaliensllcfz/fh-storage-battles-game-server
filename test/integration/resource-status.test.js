'use strict';

const chai = require('chai');
const { assertions } = require('@tapps/test');

const server = require('../../server');

let serverApp;

describe('Integration Test - Resource Status', function () {

    before(async function () {
        serverApp = await server.createApp();
    });

    it('should fail because the HTTP method is wrong', async function () {
        const res = await chai.request(serverApp)
            .post('/resource-status');

        assertions.errorChecks(res, 403);
    });

    it('should get the server version', async function () {
        const config = require('../../config');

        const res = await chai.request(serverApp)
            .get('/resource-status');

        assertions.successChecks(res, 200);
        expect(res.body).to.be.an('object');
        expect(res.body.name).to.be.equal(config.service_name);
        expect(res.body.env).to.be.equal(config.env);
        expect(res.body.version).to.be.equal(config.service_deploy_version);
    });
});
