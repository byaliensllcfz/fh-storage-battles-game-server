'use strict';

module.exports = function () {
    const chai = require('chai');
    const chaiHttp = require('chai-http');
    chai.use(chaiHttp);

    const common = require('../common');

    it('should fail because the HTTP method is wrong', async function () {
        const res = await chai.request(global.hostname)
            .post('/resource-status');
        common.errorChecks(res, 405);
    });

    it('should get an OK response', async function () {
        const config = require('../../config');
        const res = await chai.request(global.hostname)
            .get('/resource-status');
        common.successChecks(res, 200);
        res.body.should.be.deep.equal({
            name: config.service_name,
            version: config.service_deploy_version,
            env: config.env,
        });
    });
};
