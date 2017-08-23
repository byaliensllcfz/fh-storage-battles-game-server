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
            "callback": function(err, data) {
                err.should.not.be.ok;
                data.key.should.be.a("string");
                global.baseHeaders["X-Tapps-Shared-Cloud-Secret"] = data.key;
                done();
            }
        });
    });
});
