'use strict';

module.exports = function () {
    const chai = require('chai');
    const chaiHttp = require('chai-http');
    chai.use(chaiHttp);

    const common = require('../common');

    it('should fail because the HTTP method is wrong', function (done) {
        chai.request(global.hostname)
            .post('/resource-status')
            .end((err, res) => {
                common.errorChecks(err, res, 405);
                done();
            });
    });

    it('should get an OK response', function (done) {
        const config = require('../../config');
        chai.request(global.hostname)
            .get('/resource-status')
            .end((err, res) => {
                if (err) {
                    done(err);
                }
                common.successChecks(err, res, 200);
                res.body.should.be.deep.equal({
                    name: config.service_name,
                    version: config.service_deploy_version,
                    env: config.env,
                });
                done();
            });
    });
};
