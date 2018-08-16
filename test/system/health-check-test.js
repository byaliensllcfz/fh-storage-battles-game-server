'use strict';

module.exports = function () {
    const chai = require('chai');
    const chaiHttp = require('chai-http');
    chai.use(chaiHttp);

    const common = require('../common');

    it('should get an OK response', function (done) {
        chai.request(global.hostname)
            .get('/_ah/health')
            .end((err, res) => {
                if (err) {
                    done(err);
                }
                common.successChecks(err, res, 200);
                res.body.should.be.equal('OK');
                done();
            });
    });

};
