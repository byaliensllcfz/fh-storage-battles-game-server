'use strict';

const chai = require('chai');
chai.should();

function errorChecks (err, res) {
    if (err) {
        throw err;
    }
    res.body.should.have.property('type');
    res.body.should.have.property('status');
    res.body.should.have.property('title');
    res.body.should.have.property('detail');
}

module.exports = {
    errorChecks
};
