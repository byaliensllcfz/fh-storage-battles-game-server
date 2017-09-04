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
var testData = {
    string: 'string',
    date: new Date(),
    boolean: true,
    int: 5,
    array: ['string', new Date(), true, 5],
    null: null,
    undefined: undefined
};
var resultData = {
    string: 'string',
    date: new Date(),
    boolean: true,
    int: 5,
    array: ['string', new Date(), true, 5],
    null: null
};

before(function() {
    kind = 'TestNode';
    namespace = 'test-node';
    ids = [];
});

describe('Write', function() {
    it('should write an entity to datastore, using a specific id', function(done) {
        datastore.write({
            id: 'test-id',
            kind: kind,
            namespace: namespace,
            data: testData,
            callback: function(err, returnData) {
                should.not.exist(err);
                returnData.should.be.a('object');
                returnData.id.should.be.a('string');
                ids.push(returnData.id);
                delete returnData.id;
                returnData.should.be.deep.equal(testData);
                done();
            }
        });
    });
    it('should write an entity to datastore, generating an id for it', function(done) {
        datastore.write({
            kind: kind,
            namespace: namespace,
            data: testData,
            excludeFromIndexes: ['array', 'boolean'],
            callback: function(err, returnData) {
                should.not.exist(err);
                returnData.should.be.a('object');
                returnData.id.should.be.a('string');
                ids.push(returnData.id);
                delete returnData.id;
                returnData.should.be.deep.equal(testData);
                done();
            }
        });
    });
});

describe('Read', function() {
    it('should read an entity from datastore', function(done) {
        var id = 'test-id';
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: id,
            callback: function(err, data) {
                should.not.exist(err);
                data.id.should.be.equal(id);
                delete data.id;
                data.should.be.deep.equal(resultData);
                done();
            }
        });
    });
    it('should fail because there is no entity with the given id', function(done) {
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: 'wrong-id',
            callback: function(err, data) {
                should.exist(err);
                err.should.be.equal('Not found');
                done();
            }
        });
    });
});

describe('Delete', function() {
    it('should delete an entity', function(done) {
        datastore.del({
            kind: kind,
            namespace: namespace,
            id: 'test-id',
            callback: function(err) {
                should.not.exist(err);
                done();
            }
        });
    });
    it('should not find the entity deleted in the previous step', function(done) {
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: 'test-id',
            callback: function(err, data) {
                should.exist(err);
                err.should.be.equal('Not found');
                done();
            }
        });
    });
});

describe('Write Batch', function() {
    it('should write multiple entities to datastore', function(done) {
        var localIds = ['1', '2', '3', '4'];
        ids = ids.concat(localIds);
        var entities = [
            {
                string: 'string'
            },
            {
                date: new Date()
            },
            {
                boolean: true
            },
            {
                int: 5
            }
        ];
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            ids: localIds,
            entities: entities,
            excludeFromIndexes: Object.keys(testData),
            callback: function (err, data) {
                should.not.exist(err);
                data.should.be.a('array');
                done();
            }
        });
    });
    it('should write multiple entities to datastore, automatically generating indexes for them', function(done) {
        var entities = [
            {
                string: 'string'
            },
            {
                date: new Date()
            },
            {
                boolean: true
            },
            {
                int: 5
            }
        ];
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            entities: entities,
            excludeFromIndexes: Object.keys(testData),
            callback: function (err, data) {
                should.not.exist(err);
                data.should.be.a('array');
                data.forEach((entity) => {
                    entity.should.be.a('object');
                    entity.id.should.be.a('string');
                    ids.push(entity.id);
                });
                done();
            }
        });
    });
});

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