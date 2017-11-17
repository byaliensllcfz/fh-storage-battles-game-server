'use strict';

const chai   = require('chai');
const should = chai.should();

const Datastore = require('../../models/datastore');
const datastore = new Datastore();

const kind = 'TestNode';
const namespace = 'test-node';
let ids = [];

function setup(done) {
    // Create some default entities that can be used in tests
    datastore.writeMultiple({
        kind: kind,
        namespace: namespace,
        ids: ['test-1', 'test-2', 'test-3', 'test-4', 'test-5'],
        entities: [
            {
                float: 3.5,
                string: 'test-1',
                boolean: true,
                int: 2
            },
            {
                float: 4.5,
                boolean: false,
                int: 5
            },
            {
                string: 'test-3',
                date: new Date(),
                boolean: true,
                int: 5
            },
            {
                float: 3.5,
                boolean: true,
                int: 2
            },
            {
                float: 4.5,
                date: new Date(),
                boolean: false,
                int: 1
            }
        ],
        callback: function (err, data) {
            should.not.exist(err);
            should.exist(data);
            ids = ids;
            done();
        }
    });
}

function teardown(done) {
    // Query and delete any entities that remained.
    const query = datastore.createQuery(namespace, kind);
    datastore.runQuery(
        query,
        function(err, data) {
            if (err) { throw err; }
            let ids =[];
            data.entities.forEach((entity) => {
                ids.push(entity.id);
            });
            datastore.deleteMultiple({
                ids: ids,
                kind: kind,
                namespace: namespace,
                callback: function(err, data) {
                    should.not.exist(err);
                    should.exist(data);
                    done();
                }
            });
        }
    );
}

before(function(done) {
    teardown(done);
    ids = [];
});

describe('Write', function() {
    after(function(done) {
        teardown(done);
    });
    const date = new Date();
    const testData = {
        float: 6.0,
        string: 'string',
        date: new Date(),
        boolean: true,
        int: 5,
        array: ['string', date, true, 5],
        null: null,
        undefined: undefined
    };
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
    let testData;
    before(function(done) {
        testData = {test: 'test'};
        datastore.write({
            id: 'test-id',
            kind: kind,
            namespace: namespace,
            data: testData,
            excludeFromIndexes: ['test'],
            callback: function(err, data) {
                should.not.exist(err);
                should.exist(data);
                done();
            }
        });
    });
    after(function(done) {
        teardown(done);
    });
    it('should read an entity from datastore', function(done) {
        const id = 'test-id';
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: id,
            callback: function(err, data) {
                should.not.exist(err);
                data.id.should.be.equal(id);
                data.should.be.deep.equal(testData);
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
                data.should.be.equal('Not found');
                done();
            }
        });
    });
});

describe('Delete', function() {
    before(function(done) {
        datastore.write({
            id: 'test-id',
            kind: kind,
            namespace: namespace,
            data: {test: 'test'},
            excludeFromIndexes: ['test'],
            callback: function(err, data) {
                should.not.exist(err);
                should.exist(data);
                done();
            }
        });
    });
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
                data.should.be.equal('Not found');
                done();
            }
        });
    });
});

describe('Write Batch', function() {
    after(function(done) {
        teardown(done);
    });
    it('should write multiple entities to datastore', function(done) {
        const localIds = ['1', '2', '3', '4'];
        const entities = [
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
            excludeFromIndexes: ['boolean', 'date', 'int', 'string'],
            callback: function (err, data) {
                should.not.exist(err);
                data.should.be.a('array');
                done();
            }
        });
    });
    it('should write multiple entities to datastore, automatically generating indexes for them', function(done) {
        const entities = [
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
                });
                done();
            }
        });
    });
    it('should write more than 25 entities to datastore, requiring more than 1 transaction', function(done) {
        const entity = {
            int: 2,
            boolean: false
        };
        let entities = [];
        for (let i = 0; i <= 30; i++) {
            entities.push(entity);
        }
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            entities: entities,
            callback: function (err, data) {
                should.not.exist(err);
                data.should.be.a('array');
                data.forEach((entity) => {
                    entity.should.be.a('object');
                });
                done();
            }
        });
    });
});

describe('Query', function() {
    before(function(done) {
        setup(done);
    });
    after(function(done) {
        teardown(done);
    });
    it('should find no entities that match the query', function(done) {
        const query = datastore.createQuery(namespace, kind);
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
        const query = datastore.createQuery(namespace, kind);
        query.filter('int', '=', 1);
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
        const query = datastore.createQuery(namespace, kind);
        query.filter('int', '=', 2);
        query.filter('boolean', '=', true);
        datastore.runQuery(
            query,
            function(err, data) {
                should.not.exist(err);
                data.should.be.a('object');
                data.entities.should.be.a('array');
                data.entities.length.should.be.equal(2);
                data.entities[0].int.should.be.equal(2);
                data.entities[0].boolean.should.be.equal(true);
                done();
            }
        );
    });
    it('should find an entity that matches the query with an inequality filter', function(done) {
        const query = datastore.createQuery(namespace, kind);
        query.filter('int', '<', 2);
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
        const query = datastore.createQuery(namespace, kind);
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
    beforeEach(function(done) {
        setup(done);
    });
    afterEach(function(done) {
        teardown(done);
    });
    it('should delete multiple entities from datastore', function(done) {
        datastore.deleteMultiple({
            ids: ids,
            kind: kind,
            namespace: namespace,
            callback: function(err, data) {
                should.not.exist(err);
                should.exist(data);
                done();
            }
        });
    });
});