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
        importTest("Util Functions Test", './unit/util');
        importTest("Middlewares Test", './unit/middleware'); // TODO
        importTest("Datastore with Emulator", './unit/datastore'); // TODO
    });
    describe("Integration tests", function () {
        // importTest("Test name", './integration/test-file.js');
        importTest("Datastore", './integration/datastore'); // TODO
    });
    describe("System tests", function () {
        // importTest("Test name", './system/test-file.js');
        importTest("Health Check", "./system/health-check"); // TODO
    });
    // after(function () {
    //     console.log("after all tests");
    // });
});
