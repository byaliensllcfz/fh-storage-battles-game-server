'use strict';

const chai   = require('chai');
const rewire = require('rewire');
const sinon  = require('sinon');
const should = chai.should();

var gcloudDatastore = require('@google-cloud/datastore');
var Datastore       = rewire('../../models/datastore');

var sandbox, datastore;
var gcloudDatastoreStub, revertGcloudDatastore;
beforeEach(function () {
    sandbox = sinon.sandbox.create();
});
afterEach(function () {
    sandbox.restore();
});

const kind = 'TestNode';
const namespace = 'test-node';

describe('Class Instantiation', function() {
    it('should create a new datastore instance', function(done) {
        var dsStub = {
            key: sandbox.stub().returns('key'),
            get: '',
            save: '',
            delete: '',
            createQuery: '',
            runQuery: '',
            allocateIds: '',
            transaction: {
                run: '',
                save: '',
                delete: '',
                commit: '',
                rollback: ''
            }
        };
        gcloudDatastoreStub = sandbox.stub().returns(dsStub);
        revertGcloudDatastore = Datastore.__set__('gcloudDatastore', gcloudDatastoreStub);
        datastore = new Datastore();
        sinon.assert.calledOnce(gcloudDatastoreStub);
        datastore.ds.should.be.deep.equal(dsStub);
        revertGcloudDatastore();
        done();
    });
});

describe('Get ID', function() {
    it('should not convert the string because it does not represent an integer', function(done) {
        var number = 'not number';
        var result = datastore.getId(number);
        result.should.be.a('string');
        result.should.be.equal(number);
        done();
    });
    it('should convert the integer string to a datastore integer', function(done) {
        var number = '12345';
        var result = datastore.getId(number);
        result.should.be.a('object');
        result.value.should.be.equal(number);
        done();
    });
});

describe('Read', function() {
    it('should fail to read from datastore', function(done) {
        var key = 'key';
        var dsStub = {
            key: sandbox.stub().returns(key),
            get: sandbox.stub().callsFake(function (receivedKey, callback) {
                receivedKey.should.be.equal(key);
                callback(new Error());
            })
        };
        datastore.ds = dsStub;
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: 'wrong-id',
            callback: function(err, data) {
                should.exist(err);
                sinon.assert.called(dsStub.key);
                sinon.assert.calledOnce(dsStub.get);
                done();
            }
        });
    });
    it('should fail because there is no entity with the given id', function(done) {
        var key = 'key';
        var dsStub = {
            key: sandbox.stub().returns(key),
            get: sandbox.stub().callsFake(function (receivedKey, callback) {
                receivedKey.should.be.equal(key);
                callback(null, null);
            })
        };
        datastore.ds = dsStub;
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: 'wrong-id',
            callback: function(err, data) {
                should.exist(err);
                sinon.assert.called(dsStub.key);
                sinon.assert.calledOnce(dsStub.get);
                data.should.be.equal('Not found');
                done();
            }
        });
    });
    it('should read an entity from datastore', function(done) {
        var id = 'test-id';
        var resultData = {
            float: 6.0,
            string: 'string',
            boolean: true,
            int: 5,
            array: ['string', true, 5],
            null: null
        };
        var key = 'key';
        var dsStub = {
            key: sandbox.stub().returns(key),
            get: sandbox.stub().callsFake(function (receivedKey, callback) {
                receivedKey.should.be.equal(key);
                var result = JSON.parse(JSON.stringify(resultData));
                result[gcloudDatastore.KEY] = {};
                result[gcloudDatastore.KEY].name = id;
                callback(null, result);
            })
        };
        datastore.ds = dsStub;
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: id,
            callback: function(err, data) {
                should.not.exist(err);
                sinon.assert.called(dsStub.key);
                sinon.assert.calledOnce(dsStub.get);
                data.id.should.be.equal(id);
                delete data.id;
                data.should.be.deep.equal(resultData);
                done();
            }
        });
    });
});

describe('Write', function() {
    var date = new Date();
    var testData = {
        float: 6.0,
        string: 'string',
        date: new Date(),
        boolean: true,
        int: 5,
        array: ['string', date, true, 5],
        null: null,
        undefined: undefined
    };
    var resultData = {
        float: 6.0,
        string: 'string',
        date: new Date(),
        boolean: true,
        int: 5,
        array: ['string', date, true, 5],
        null: null
    };
    it('should fail to write an entity', function(done) {
        var key = 'key';
        var dsStub = {
            key: sandbox.stub().returns(key),
            save: sandbox.stub().callsFake(function (entity, callback) {
                entity.key.should.be.equal(key);
                entity.data.should.be.a('array');
                callback(new Error());
            })
        };
        datastore.ds = dsStub;
        datastore.write({
            id: 'test-id',
            kind: kind,
            namespace: namespace,
            data: testData,
            callback: function(err, returnData) {
                should.exist(err);
                sinon.assert.called(dsStub.key);
                sinon.assert.calledOnce(dsStub.save);
                done();
            }
        });
    });
    it('should write an entity to datastore, using a specific id', function(done) {
        var key = 'key';
        var dsStub = {
            key: sandbox.stub().returns(key),
            save: sandbox.stub().callsFake(function (entity, callback) {
                entity.key.should.be.equal(key);
                entity.data.should.be.a('array');
                callback(null, resultData);
            })
        };
        datastore.ds = dsStub;
        datastore.write({
            id: 'test-id',
            kind: kind,
            namespace: namespace,
            data: testData,
            callback: function(err, returnData) {
                should.not.exist(err);
                sinon.assert.called(dsStub.key);
                sinon.assert.calledOnce(dsStub.save);
                returnData.should.be.a('object');
                returnData.should.be.deep.equal(testData);
                done();
            }
        });
    });
    it('should write an entity to datastore, generating an id for it', function(done) {
        var key = 'key';
        var dsStub = {
            key: sandbox.stub().returns(key),
            save: sandbox.stub().callsFake(function (entity, callback) {
                entity.key.should.be.equal(key);
                entity.data.should.be.a('array');
                var result = JSON.parse(JSON.stringify(resultData));
                result.mutationResults = [{key: {path: [{id: '5'}]}}];
                callback(null, result);
            })
        };
        datastore.ds = dsStub;
        datastore.write({
            kind: kind,
            namespace: namespace,
            data: testData,
            excludeFromIndexes: ['array', 'date'],
            callback: function(err, returnData) {
                should.not.exist(err);
                sinon.assert.called(dsStub.key);
                sinon.assert.calledOnce(dsStub.save);
                returnData.should.be.a('object');
                delete returnData.id;
                returnData.should.be.deep.equal(testData);
                done();
            }
        });
    });
});

describe('Delete', function() {
    it('should fail to delete an entity', function(done) {
        var key = 'key';
        var dsStub = {
            key: sandbox.stub().returns(key),
            delete: sandbox.stub().callsFake(function (receivedKey, callback) {
                receivedKey.should.be.equal(key);
                callback(new Error());
            })
        };
        datastore.ds = dsStub;
        datastore.del({
            kind: kind,
            namespace: namespace,
            id: 'test-id',
            callback: function(err) {
                should.exist(err);
                sinon.assert.called(dsStub.key);
                sinon.assert.calledOnce(dsStub.delete);
                done();
            }
        });
    });
    it('should delete an entity', function(done) {
        var key = 'key';
        var dsStub = {
            key: sandbox.stub().returns(key),
            delete: sandbox.stub().callsFake(function (receivedKey, callback) {
                receivedKey.should.be.equal(key);
                callback(null);
            })
        };
        datastore.ds = dsStub;
        datastore.del({
            kind: kind,
            namespace: namespace,
            id: 'test-id',
            callback: function(err) {
                should.not.exist(err);
                sinon.assert.called(dsStub.key);
                sinon.assert.calledOnce(dsStub.delete);
                done();
            }
        });
    });
});

describe('Query', function() {
    it('should fail to query entiteis', function(done) {
        var queryStub;
        var dsStub = {
            createQuery: sandbox.stub().returns(queryStub),
            runQuery: sandbox.stub().callsFake(function (query, callback) {
                callback(new Error());
            })
        };
        datastore.ds = dsStub;
        var query = datastore.createQuery(namespace, kind);
        datastore.runQuery(
            query,
            function(err, data) {
                should.exist(err);
                sinon.assert.calledOnce(dsStub.createQuery);
                sinon.assert.calledOnce(dsStub.runQuery);
                done();
            }
        );
    });
    it('should fail to query entiteis', function(done) {
        var id = 'test-id';
        var entities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            },
            {
                boolean: true,
            },
            {
                int: 5,
            },
            {
                array: ['string', true, 5],
            },
            {
                null: null
            },
        ];
        var queryStub;
        var dsStub = {
            createQuery: sandbox.stub().returns(queryStub),
            runQuery: sandbox.stub().callsFake(function (query, callback) {
                var newEntities = [];
                entities.forEach((entity) => {
                    entity[gcloudDatastore.KEY] = {};
                    entity[gcloudDatastore.KEY].name = id;
                    newEntities.push(entity);
                });
                var info = {};
                callback(null, newEntities, info);
            })
        };
        datastore.ds = dsStub;
        var query = datastore.createQuery(namespace, kind);
        datastore.runQuery(
            query,
            function(err, data) {
                should.not.exist(err);
                sinon.assert.calledOnce(dsStub.createQuery);
                sinon.assert.calledOnce(dsStub.runQuery);
                data.entities.should.be.deep.equal(entities);
                done();
            }
        );
    });
});

describe('Run Transaction', function() {
    it('should fail to run the transaction', function(done) {
        var transactionStub = {
            run: sandbox.stub().callsFake(function(callback) {
                callback(new Error());
            }),
            save: sandbox.stub(),
            delete: sandbox.stub(),
            commit: sandbox.stub()
        };
        datastore.transactionRun(transactionStub, 'save', {})
            .then((entities) => {
                throw new Error('Expected transaction to fail.');
            })
            .catch((err) => {
                should.exist(err);
                sinon.assert.calledOnce(transactionStub.run);
                done();
            });
    });
    it('should fail because the operation is invalid', function(done) {
        var transactionStub = {
            run: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            save: sandbox.stub(),
            delete: sandbox.stub(),
            commit: sandbox.stub()
        };
        datastore.transactionRun(transactionStub, 'wrong-operation', {})
            .then((entities) => {
                throw new Error('Expected transaction to fail.');
            })
            .catch((err) => {
                should.exist(err);
                sinon.assert.calledOnce(transactionStub.run);
                done();
            });
    });
    it('should fail to commit the transaction', function(done) {
        var testEntities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            }
        ];
        var transactionStub = {
            run: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            save: sandbox.stub(),
            delete: sandbox.stub(),
            commit: sandbox.stub().callsFake(function(callback) {
                callback(new Error());
            })
        };
        datastore.transactionRun(transactionStub, 'save', testEntities)
            .then((entities) => {
                throw new Error('Expected transaction to fail.');
            })
            .catch((err) => {
                should.exist(err);
                sinon.assert.calledOnce(transactionStub.run);
                sinon.assert.calledOnce(transactionStub.save);
                sinon.assert.calledWith(transactionStub.save, testEntities);
                sinon.assert.calledOnce(transactionStub.commit);
                done();
            });
    });
    it('should successfully run a save transaction', function(done) {
        var testEntities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            }
        ];
        var transactionStub = {
            run: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            save: sandbox.stub(),
            delete: sandbox.stub(),
            commit: sandbox.stub().callsFake(function(callback) {
                callback();
            })
        };
        datastore.transactionRun(transactionStub, 'save', testEntities)
            .then((entities) => {
                entities.should.be.deep.equal(testEntities);
                sinon.assert.calledOnce(transactionStub.run);
                sinon.assert.calledOnce(transactionStub.save);
                sinon.assert.calledWith(transactionStub.save, testEntities);
                sinon.assert.calledOnce(transactionStub.commit);
                done();
            })
            .catch((err) => {
                throw err;
            });
    });
    it('should successfully run a delete transaction', function(done) {
        var testEntities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            }
        ];
        var transactionStub = {
            run: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            save: sandbox.stub(),
            delete: sandbox.stub(),
            commit: sandbox.stub().callsFake(function(callback) {
                callback();
            })
        };
        datastore.transactionRun(transactionStub, 'delete', testEntities)
            .then((entities) => {
                entities.should.be.deep.equal(testEntities);
                sinon.assert.calledOnce(transactionStub.run);
                sinon.assert.calledOnce(transactionStub.delete);
                sinon.assert.calledWith(transactionStub.delete, testEntities);
                sinon.assert.calledOnce(transactionStub.commit);
                done();
            })
            .catch((err) => {
                throw err;
            });
    });
});

describe('Save Entities', function() {
    it('should fail to save entities', function(done) {
        var keys = [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}];
        var entities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            },
            {
                boolean: true,
            },
            {
                int: 5,
            },
            {
                array: ['string', true, 5],
            },
            {
                null: null
            }
        ];
        var rollbackStub = sandbox.stub();
        var dsStub = {
            transaction: sandbox.stub().returns(
                    {rollback: rollbackStub}
                )
        };
        datastore.ds = dsStub;
        datastore.transactionRun = function() {
            return new Promise((resolve, reject) => {
                reject(new Error());
            });
        };
        datastore.saveEntities({
            keys: keys,
            entities: entities,
            callback: function(err, data) {
                should.exist(err);
                sinon.assert.calledOnce(dsStub.transaction);
                sinon.assert.called(rollbackStub);
                done();
            }
        });
    });
    it('should successfully save entities', function(done) {
        var keys = [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}];
        var entities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            },
            {
                boolean: true,
            },
            {
                int: 5,
            },
            {
                array: ['string', true, 5],
            },
            {
                null: null
            }
        ];
        var rollbackStub = sandbox.stub();
        var dsStub = {
            transaction: sandbox.stub().returns(
                    {rollback: rollbackStub}
                )
        };
        datastore.ds = dsStub;
        datastore.transactionRun = function() {
            return new Promise((resolve, reject) => {
                resolve();
            });
        };
        datastore.saveEntities({
            keys: keys,
            entities: entities,
            callback: function(err, data) {
                should.not.exist(err);
                sinon.assert.calledOnce(dsStub.transaction);
                sinon.assert.notCalled(rollbackStub);
                done();
            }
        });
    });
});

describe('Write Multiple', function() {
    it('should write multiple entities to datastore', function(done) {
        var key = 'key';
        var localIds = ['1', '2', '3', '4'];
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
        var dsStub = {
            key: sandbox.stub().returns(key)
        };
        datastore.ds = dsStub;
        datastore.saveEntities = sandbox.stub().callsFake(function(params) {
            params.callback(
                null,
                {
                    keys:params.keys,
                    entities: params.entities
                }
            );
        });
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            ids: localIds,
            entities: entities,
            excludeFromIndexes: ['boolean', 'date', 'int', 'string'],
            callback: function (err, data) {
                should.not.exist(err);
                data.should.be.a('object');
                data.keys.should.be.a('array');
                data.entities.should.be.deep.equal(entities);
                sinon.assert.calledOnce(datastore.saveEntities);
                sinon.assert.callCount(dsStub.key, 4);
                done();
            }
        });
    });
    it('should fail to allocate IDs for the entities', function(done) {
        var key = 'key';
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
        var dsStub = {
            key: sandbox.stub().returns(key),
            allocateIds: sandbox.stub().callsFake(function(incompleteKey, length) {
                return new Promise((resolve, reject) => {
                    reject('Failed to allocate IDs.');
                });
            })
        };
        datastore.ds = dsStub;
        datastore.saveEntities = sandbox.stub().callsFake(function(params) {
            params.callback(
                null,
                {
                    keys:params.keys,
                    entities: params.entities
                }
            );
        });
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            entities: entities,
            callback: function (err, data) {
                should.exist(err);
                sinon.assert.calledOnce(dsStub.key);
                sinon.assert.calledOnce(dsStub.allocateIds);
                done();
            }
        });
    });
    it('should write multiple entities to datastore, automatically generating indexes for them', function(done) {
        var key = 'key';
        var localIds = ['1', '2', '3', '4'];
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
        var dsStub = {
            key: sandbox.stub().returns(key),
            allocateIds: sandbox.stub().callsFake(function(incompleteKey, length) {
                return new Promise((resolve, reject) => {
                    resolve([localIds]);
                });
            })
        };
        datastore.ds = dsStub;
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            entities: entities,
            callback: function (err, data) {
                should.not.exist(err);
                sinon.assert.calledOnce(dsStub.key);
                sinon.assert.calledOnce(dsStub.allocateIds);
                sinon.assert.calledOnce(datastore.saveEntities);
                done();
            }
        });
    });
});

describe('Delete Multiple', function() {
    it('should fail to delete entities', function(done) {
        var key = 'key';
        var ids = [1, 2, 3, 4, 5, 6];
        var rollbackStub = sandbox.stub();
        var dsStub = {
            key: sandbox.stub().returns(key),
            transaction: sandbox.stub().returns(
                    {rollback: rollbackStub}
                )
        };
        datastore.ds = dsStub;
        datastore.transactionRun = function() {
            return new Promise((resolve, reject) => {
                reject(new Error());
            });
        };
        datastore.deleteMultiple({
            ids: ids,
            kind: kind,
            namespace: namespace,
            callback: function(err, data) {
                should.exist(err);
                sinon.assert.calledOnce(dsStub.transaction);
                sinon.assert.called(rollbackStub);
                done();
            }
        });
    });
    it('should successfully delete entities', function(done) {
        var key = 'key';
        var ids = [1, 2, 3, 4, 5, 6];
        var rollbackStub = sandbox.stub();
        var dsStub = {
            key: sandbox.stub().returns(key),
            transaction: sandbox.stub().returns(
                    {rollback: rollbackStub}
                )
        };
        datastore.ds = dsStub;
        datastore.transactionRun = function() {
            return new Promise((resolve, reject) => {
                resolve();
            });
        };
        datastore.deleteMultiple({
            ids: ids,
            kind: kind,
            namespace: namespace,
            callback: function(err, data) {
                should.not.exist(err);
                sinon.assert.calledOnce(dsStub.transaction);
                sinon.assert.notCalled(rollbackStub);
                done();
            }
        });
    });
});