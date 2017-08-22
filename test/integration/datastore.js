"use strict";

var common = require("../common");
const datastore = require("../../models/datastore");

const chai = require("chai");
const request = require("supertest");
const should = chai.should();
var expect = chai.expect;

describe("General tests", function() {
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
