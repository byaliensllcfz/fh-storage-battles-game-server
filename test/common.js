'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

function errorChecks (err, res, status) {
    res.should.have.status(status);
    res.body.should.have.property('type');
    res.body.should.have.property('status');
    res.body.should.have.property('title');
    res.body.should.have.property('detail');
}

module.exports = {
    errorChecks
};
