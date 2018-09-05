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

    it('should get the server version', async function () {
        const config = require('../../config');

        const res = await chai.request(global.hostname)
            .get('/resource-status');

        common.successChecks(res, 200);
        res.body.should.be.an('object');
        res.body.name.should.be.equal(config.service_name);
        res.body.env.should.be.equal(config.env);
        res.body.version.should.be.a('string');
        const version = res.body.version.split('-');
        const expectedVersion = config.service_version.split('.');
        for (let i = expectedVersion.length - 1; i >= 0; i--) {
            version[i].should.be.equal(expectedVersion[i]);
        }
        parseInt(version[3]).should.be.a('number');
    });
};
