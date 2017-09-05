'use strict';

const chai   = require('chai');
const rewire = require('rewire');
const sinon  = require('sinon');
const expect = chai.expect;
const should = chai.should();

const datastore = require('../../models/datastore');

function cleanup(done) {
    // Query and delete any entities that remained.
    var query = datastore.createQuery(namespace, kind);
    datastore.runQuery(
        query,
        function(err, data) {
            var ids =[];
            data.entities.forEach((entity) => {
                ids.push(entity.id);
            });
            datastore.deleteMultiple({
                ids: ids,
                kind: kind,
                namespace: namespace,
                callback: function(err, data) {
                    should.not.exist(err);
                    done();
                }
            });
        }
    );
}

var kind;
var namespace;
var ids;
var date = new Date();
var testData = {
    string: 'string',
    date: new Date(),
    boolean: true,
    int: 5,
    array: ['string', date, true, 5],
    null: null,
    undefined: undefined
};
var resultData = {
    string: 'string',
    date: new Date(),
    boolean: true,
    int: 5,
    array: ['string', date, true, 5],
    null: null
};

before(function(done) {
    kind = 'TestNode';
    namespace = 'test-node';
    cleanup(done);
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
            excludeFromIndexes: ['array', 'date'],
            callback: function(err, returnData) {
                should.not.exist(err);
                returnData.should.be.a('object');
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
                boolean: true,
                string: 'test'
            },
            {
                date: new Date()
            },
            {
                boolean: true
            },
            {
                int: 1,
                boolean: true
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
                int: 2,
                boolean: false
            },
            {
                boolean: true,
                int: 5
            }
        ];
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            entities: entities,
            callback: function (err, data) {
                should.not.exist(err);
                data.should.be.a('array');
                data.forEach((entity) => {
                    entity.should.be.a('object');
                    ids.push(entity.id);
                });
                done();
            }
        });
    });
});

describe('Query', function() {
    it('should find no entities that match the query', function(done) {
        var query = datastore.createQuery(namespace, kind);
        query.filter('int', '=', 0);
        datastore.runQuery(
            query,
            function(err, data) {
                should.not.exist(err);
                data.should.be.deep.equal({ entities: [] });
                done();
            }
        );
    });
    it('should find one entity that matches the query with an equality filter', function(done) {
        var query = datastore.createQuery(namespace, kind);
        query.filter('int', '=', 2);
        datastore.runQuery(
            query,
            function(err, data) {
                should.not.exist(err);
                data.should.be.a('object');
                data.entities.should.be.a('array');
                data.entities.length.should.be.equal(1);
                done();
            }
        );
    });
    it('should find multiple entities that match the query with multiple equality filters', function(done) {
        var query = datastore.createQuery(namespace, kind);
        query.filter('int', '=', 5);
        query.filter('boolean', '=', true);
        datastore.runQuery(
            query,
            function(err, data) {
                should.not.exist(err);
                data.should.be.a('object');
                data.entities.should.be.a('array');
                data.entities.length.should.be.equal(2);
                data.entities[0].int.should.be.equal(5);
                data.entities[0].boolean.should.be.equal(true);
                done();
            }
        );
    });
    it('should find an entity that matches the query with an inequality filter', function(done) {
        var query = datastore.createQuery(namespace, kind);
        query.filter('int', '<', 3);
        datastore.runQuery(
            query,
            function(err, data) {
                should.not.exist(err);
                data.should.be.a('object');
                data.entities.should.be.a('array');
                data.entities.length.should.be.equal(1);
                done();
            }
        );
    });
    it('should limit the number of entities returned by the query', function(done) {
        var query = datastore.createQuery(namespace, kind);
        query.filter('int', '>', 0);
        query.limit(2);
        datastore.runQuery(
            query,
            function(err, data) {
                should.not.exist(err);
                data.should.be.a('object');
                data.entities.should.be.a('array');
                data.entities.length.should.be.equal(2);
                done();
            }
        );
    });
});

describe('Delete Batch', function() {
    it('should delete multiple entities from datastore', function(done) {
        datastore.deleteMultiple({
            ids: ids,
            kind: kind,
            namespace: namespace,
            callback: function(err, data) {
                should.not.exist(err);
                done();
            }
        });
    });
});

after(function(done) {
    cleanup(done);
});