'use strict';

module.exports = function () {
    const chai = require('chai');
    const chaiHttp = require('chai-http');
    chai.use(chaiHttp);

    const common = require('../common');

    describe('Liveness Check', function () {
        it('should fail because the HTTP method is wrong', async function () {
            const res = await chai.request(global.hostname)
                .post('/liveness-check');

            common.errorChecks(res, 403);
        });

        it('should get an OK response', async function () {
            const res = await chai.request(global.hostname)
                .get('/liveness-check');

            common.successChecks(res, 200);
            res.body.should.be.an('object');
        });
    });

    describe('Readiness Check', function () {
        it('should fail because the HTTP method is wrong', async function () {
            const res = await chai.request(global.hostname)
                .post('/readiness-check');

            common.errorChecks(res, 403);
        });

        it('should get an OK response', async function () {
            const res = await chai.request(global.hostname)
                .get('/readiness-check');

            common.successChecks(res, 200);
            res.body.should.be.an('object');
        });
    });
};
