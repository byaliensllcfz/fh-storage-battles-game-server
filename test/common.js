"use strict";

const chai = require("chai");
const request = require("supertest");
const should = chai.should();
var expect = chai.expect;

function errorChecks(err, res){
    if (err) throw err;
    res.body.should.have.property("type");
    res.body.should.have.property("status");
    res.body.should.have.property("title");
    res.body.should.have.property("detail");
}

module.exports = {
    errorChecks
};