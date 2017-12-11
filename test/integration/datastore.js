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
        ]
    }).then((data) => {
        should.exist(data);
        // ids = ids;
        done();
    }).catch((err) => {
        throw err;
    });
}

function teardown(done) {
    // Query and delete any entities that remained.
    const query = datastore.createQuery(namespace, kind);
    datastore.runQuery(query)
    .then((data) => {
        let ids =[];
        data.entities.forEach((entity) => {
            ids.push(entity.id);
        });
        datastore.deleteMultiple({
            ids: ids,
            kind: kind,
            namespace: namespace
        }).then(function (data) {
            should.exist(data);
                done();
        }).catch(function (error) {
            throw error;
        });
    }).catch((err) => {
        throw err;
    });
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
            data: testData
        }).then(function (returnData) {
            returnData.should.be.a('object');
                ids.push(returnData.id);
                delete returnData.id;
                returnData.should.be.deep.equal(testData);
                done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should write an entity to datastore, generating an id for it', function(done) {
        datastore.write({
            kind: kind,
            namespace: namespace,
            data: testData,
            excludeFromIndexes: ['array', 'date']
        }).then(function (returnData) {
            returnData.should.be.a('object');
            ids.push(returnData.id);
            delete returnData.id;
            returnData.should.be.deep.equal(testData);
            done();
        }).catch(function (error) {
            throw error;
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
            excludeFromIndexes: ['test']
        }).then(function (data) {
            should.exist(data);
            done();
        }).catch(function (error) {
            throw error;
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
            id: id
        }).then(function (data) {
            data.id.should.be.equal(id);
            data.should.be.deep.equal(testData);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should fail because there is no entity with the given id', function(done) {
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: 'wrong-id'
        }).then(function (data) {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            error.message.should.be.equal('Not found');
            done();
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
            excludeFromIndexes: ['test']
        }).then(function (data) {
            should.exist(data);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should delete an entity', function(done) {
        datastore.del({
            kind: kind,
            namespace: namespace,
            id: 'test-id'
        }).then(function () {
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should not find the entity deleted in the previous step', function(done) {
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: 'test-id'
        }).then(function (data) {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            error.message.should.be.equal('Not found');
            done();
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
            excludeFromIndexes: ['boolean', 'date', 'int', 'string']
        }).then(function (data) {
            data.should.be.a('array');
            done();
        }).catch(function (error) {
            throw error;
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
            entities: entities
        }).then(function (data) {
            data.should.be.a('array');
            data.forEach((entity) => {
                entity.should.be.a('object');
            });
            done();
        }).catch(function (error) {
            throw error;
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
            entities: entities
        }).then(function (data) {
            data.should.be.a('array');
            data.forEach((entity) => {
                entity.should.be.a('object');
            });
            done();
        }).catch(function (error) {
            throw error;
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
        datastore.runQuery(query)
        .then(function (data) {
            data.should.be.deep.equal({ entities: [] });
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should find one entity that matches the query with an equality filter', function(done) {
        const query = datastore.createQuery(namespace, kind);
        query.filter('int', '=', 1);
        datastore.runQuery(query)
        .then(function (data) {
            data.should.be.a('object');
            data.entities.should.be.a('array');
            data.entities.length.should.be.equal(1);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should find multiple entities that match the query with multiple equality filters', function(done) {
        const query = datastore.createQuery(namespace, kind);
        query.filter('int', '=', 2);
        query.filter('boolean', '=', true);
        datastore.runQuery(query)
        .then(function (data) {
            data.should.be.a('object');
            data.entities.should.be.a('array');
            data.entities.length.should.be.equal(2);
            data.entities[0].int.should.be.equal(2);
            data.entities[0].boolean.should.be.equal(true);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should find an entity that matches the query with an inequality filter', function(done) {
        const query = datastore.createQuery(namespace, kind);
        query.filter('int', '<', 2);
        datastore.runQuery(query)
        .then(function (data) {
            data.should.be.a('object');
            data.entities.should.be.a('array');
            data.entities.length.should.be.equal(1);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should limit the number of entities returned by the query', function(done) {
        const query = datastore.createQuery(namespace, kind);
        query.filter('int', '>', 0);
        query.limit(2);
        datastore.runQuery(query)
        .then(function (data) {
            data.should.be.a('object');
            data.entities.should.be.a('array');
            data.entities.length.should.be.equal(2);
            done();
        }).catch(function (error) {
            throw error;
        });
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
            namespace: namespace
        }).then(function (data) {
            should.exist(data);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
});