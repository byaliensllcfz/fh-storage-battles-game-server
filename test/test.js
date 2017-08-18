"use strict";

const chai = require("chai");
const request = require("supertest");
const should = chai.should();
var expect = chai.expect;

var common = require("./common");
var datastore = require("../model/datastore");

global.baseHeaders = {
    "Content-Type": "application/json",
    "X-Tapps-Bundle-Id": "br.com.tapps.toiletman"
};
describe("Datastore", function() {
    it("should read the Shared Cloud Secret from Datastore", function(done) {
        datastore.read({
            "id": "latest",
            "kind": "SharedCloudSecret",
            "namespace": "cloud-configs",
            "callback": function(params) {
                params.should.be.a("object");
                params.error.should.not.be.ok;
                params.data.key.should.be.a("string");
                global.baseHeaders["X-Tapps-Shared-Cloud-Secret"] = params.data.key;
                done();
            }
        });
    });
});

function importTest(name, path) {
    describe(name, function () {
        require(path);
    });
}

describe("Service Name Tests", function () {
    // beforeEach(function () {
    //    console.log("running something before each test");
    // });
    describe("Unit tests", function () {
        // importTest("Test name", './unit/test-file.js');
    });
    describe("Integration tests", function () {
        // importTest("Test name", './integration/test-file.js');
    });
    // after(function () {
    //     console.log("after all tests");
    // });
});
