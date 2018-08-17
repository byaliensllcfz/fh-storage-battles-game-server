'use strict';

module.exports = function () {
    const chai = require('chai');
    const chaiHttp = require('chai-http');
    chai.use(chaiHttp);

    const common = require('../common');

    it('should get an OK response', async function () {
        const res = await chai.request(global.hostname)
            .get('/_ah/health');
        common.successChecks(res, 200);
        res.body.should.be.equal('OK');
    });
};
