"use strict";

const chai = require("chai");
const request = require("supertest");
const should = chai.should();
var expect = chai.expect;

var common = require("./common");

global.baseHeaders = {
    "Content-Type": "application/json",
    "X-Tapps-Bundle-Id": "br.com.tapps.toiletman"
};

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
        importTest("Datastore", './integration/datastore');
    });
    describe("System tests", function () {
        // importTest("Test name", './system/test-file.js');
    });
    // after(function () {
    //     console.log("after all tests");
    // });
});
