'use strict';

const chai   = require('chai');
const rewire = require('rewire');
const sinon  = require('sinon');
const expect = chai.expect;
const should = chai.should();

const common    = require('../common');
const datastore = require('../../models/datastore');

var kind;
var namespace;
var ids;

before(function() {
    kind = "TestNode";
    namespace = "test-node";
    ids = [];
});

describe('Write', function() {
    it('should write an entity to datastore, using a specific id', function(done) {
        var data = {
            testData: "test"
        };
        datastore.write({
            id: 'test-id',
            kind: kind,
            namespace: namespace,
            data: data,
            callback: function(err, returnData) {
                should.not.exist(err);
                returnData.should.be.a("object");
                returnData.id.should.be.a("string");
                ids.push(returnData.id);
                delete returnData.id;
                returnData.should.be.deep.equal(data);
                done();
            }
        });
    });
    it('should write an entity to datastore, generating an id for it', function(done) {
        var data = {
            string: "string",
            date: new Date(),
            boolean: true,
            int: 5,
            array: ["string", new Date(), true, 5]
        };
        datastore.write({
            kind: kind,
            namespace: namespace,
            data: data,
            excludeFromIndexes: ["array", "boolean"],
            callback: function(err, returnData) {
                should.not.exist(err);
                returnData.should.be.a("object");
                returnData.id.should.be.a("string");
                ids.push(returnData.id);
                delete returnData.id;
                returnData.should.be.deep.equal(data);
                done();
            }
        });
    });
    it('should fail to write to datastore because one of the properties is undefined', function(done) {
        var data = {
            testData: undefined
        };
        datastore.write({
            id: 'test-id',
            kind: kind,
            namespace: namespace,
            data: data,
            callback: function(err, returnData) {
                should.not.exist(err);
                returnData.should.be.a("object");
                returnData.id.should.be.a("string");
                ids.push(returnData.id);
                delete returnData.id;
                returnData.should.be.deep.equal(data);
                done();
            }
        });
    });
});

// describe('Read', function() {
//     it('', function(done) {
//         datastore.read();
//     });
// });

// describe('Delete', function() {
//     it('', function(done) {
//         datastore.del();
//     });
// });

// describe('Write Batch', function() {
//     it('', function(done) {
//         datastore.writeMultiple();
//     });
// });

// describe('Query', function() {
//     it('', function(done) {
//         datastore.createQuery();
//     });
// });

// describe('Delete Batch', function() {
//     it('', function(done) {
//         datastore.deleteMultiple();
//     });
// });

after(function() {
    if(ids) {
        datastore.deleteMultiple({
            ids: ids,
            kind: kind,
            namespace: namespace,
            callback: function(err, data) {
                if(err) {
                    console.log('Failed to delete the following IDs:', ids.join(', '));
                }
            }
        });
    }
});