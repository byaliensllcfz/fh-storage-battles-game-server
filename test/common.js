'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

function successChecks(err, res, status) {
    if (res.statusCode !== status) {
        console.error(res.body); // eslint-disable-line no-console
        if (err) {
            throw err;
        } else {
            res.should.have.status(status);
        }
    }
}

function errorChecks(err, res, status) {
    const expected = {
        status: status,
        type: res.body.type ? res.body.type : 'Invalid',
        title: res.body.title ? res.body.title : 'Invalid',
        detail: res.body.detail ? res.body.detail : 'Invalid',
    };
    res.body.should.be.deep.equal(expected);
}

module.exports = {
    errorChecks,
    successChecks,
};
