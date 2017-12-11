'use strict';

const chai             = require('chai');
const rewire           = require('rewire');
const sinon            = require('sinon');
const sinonStubPromise = require('sinon-stub-promise');
const should           = chai.should();
sinonStubPromise(sinon);

const gcloudDatastore = require('@google-cloud/datastore');
const Datastore       = rewire('../../models/datastore');

let sandbox, datastore;
let gcloudDatastoreStub, revertGcloudDatastore;
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
        const dsStub = {
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
        const number = 'not number';
        const result = datastore.getId(number);
        result.should.be.a('string');
        result.should.be.equal(number);
        done();
    });
    it('should convert the integer string to a datastore integer', function(done) {
        const number = '12345';
        const result = datastore.getId(number);
        result.should.be.a('object');
        result.value.should.be.equal(number);
        done();
    });
});

describe('Read', function() {
    it('should fail to read from datastore', function(done) {
        const key = 'key';
        const dsStub = {
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
            id: 'wrong-id'
        }).then(function () {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.called(dsStub.key);
            sinon.assert.calledOnce(dsStub.get);
            done();
        });
    });
    it('should fail because there is no entity with the given id', function(done) {
        const key = 'key';
        const dsStub = {
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
            id: 'wrong-id'
        }).then(function () {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.called(dsStub.key);
            sinon.assert.calledOnce(dsStub.get);
            error.message.should.be.equal('Not found');
            done();
        });
    });
    it('should read an entity from datastore', function(done) {
        const id = 'test-id';
        const resultData = {
            float: 6.0,
            string: 'string',
            boolean: true,
            int: 5,
            array: ['string', true, 5],
            null: null
        };
        const key = 'key';
        const dsStub = {
            key: sandbox.stub().returns(key),
            get: sandbox.stub().callsFake(function (receivedKey, callback) {
                receivedKey.should.be.equal(key);
                const result = JSON.parse(JSON.stringify(resultData));
                result[gcloudDatastore.KEY] = {};
                result[gcloudDatastore.KEY].name = id;
                callback(null, result);
            })
        };
        datastore.ds = dsStub;
        datastore.read({
            kind: kind,
            namespace: namespace,
            id: id
        }).then(function (data) {
            sinon.assert.called(dsStub.key);
            sinon.assert.calledOnce(dsStub.get);
            data.id.should.be.equal(id);
            delete data.id;
            data.should.be.deep.equal(resultData);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
});

describe('Write', function() {
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
    const resultData = {
        float: 6.0,
        string: 'string',
        date: new Date(),
        boolean: true,
        int: 5,
        array: ['string', date, true, 5],
        null: null
    };
    it('should fail to write an entity', function(done) {
        const key = 'key';
        const dsStub = {
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
            data: testData
        }).then(function () {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.called(dsStub.key);
            sinon.assert.calledOnce(dsStub.save);
            done();
        });
    });
    it('should write an entity to datastore, using a specific id', function(done) {
        const key = 'key';
        const dsStub = {
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
            data: testData
        }).then(function (returnData) {
            sinon.assert.called(dsStub.key);
            sinon.assert.calledOnce(dsStub.save);
            returnData.should.be.a('object');
            returnData.should.be.deep.equal(testData);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should write an entity to datastore, generating an id for it', function(done) {
        const key = 'key';
        const dsStub = {
            key: sandbox.stub().returns(key),
            save: sandbox.stub().callsFake(function (entity, callback) {
                entity.key.should.be.equal(key);
                entity.data.should.be.a('array');
                const result = JSON.parse(JSON.stringify(resultData));
                result.mutationResults = [{key: {path: [{id: '5'}]}}];
                callback(null, result);
            })
        };
        datastore.ds = dsStub;
        datastore.write({
            kind: kind,
            namespace: namespace,
            data: testData,
            excludeFromIndexes: ['array', 'date']
        }).then(function (returnData) {
            sinon.assert.called(dsStub.key);
            sinon.assert.calledOnce(dsStub.save);
            returnData.should.be.a('object');
            delete returnData.id;
            returnData.should.be.deep.equal(testData);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
});

describe('Delete', function() {
    it('should fail to delete an entity', function(done) {
        const key = 'key';
        const dsStub = {
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
            id: 'test-id'
        }).then(function () {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.called(dsStub.key);
            sinon.assert.calledOnce(dsStub.delete);
            done();
        });
    });
    it('should delete an entity', function(done) {
        const key = 'key';
        const dsStub = {
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
            id: 'test-id'
        }).then(function () {
            sinon.assert.called(dsStub.key);
            sinon.assert.calledOnce(dsStub.delete);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
});

describe('Query', function() {
    it('should fail to query entiteis', function(done) {
        let queryStub;
        const dsStub = {
            createQuery: sandbox.stub().returns(queryStub),
            runQuery: sandbox.stub().callsFake(function (query, callback) {
                callback(new Error());
            })
        };
        datastore.ds = dsStub;
        const query = datastore.createQuery(namespace, kind);
        datastore.runQuery(query)
            .then(function () {
                throw new Error('Expected operation to fail.');
            }).catch(function (error) {
                should.exist(error);
                sinon.assert.calledOnce(dsStub.createQuery);
                sinon.assert.calledOnce(dsStub.runQuery);
                done();
            });
    });
    it('should fail to query entities', function(done) {
        const id = 'test-id';
        const entities = [
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
        let queryStub;
        const dsStub = {
            createQuery: sandbox.stub().returns(queryStub),
            runQuery: sandbox.stub().callsFake(function (query, callback) {
                let newEntities = [];
                entities.forEach((entity) => {
                    entity[gcloudDatastore.KEY] = {};
                    entity[gcloudDatastore.KEY].name = id;
                    newEntities.push(entity);
                });
                let info = {};
                callback(null, newEntities, info);
            })
        };
        datastore.ds = dsStub;
        const query = datastore.createQuery(namespace, kind);
        datastore.runQuery(query)
            .then(function (data) {
                sinon.assert.calledOnce(dsStub.createQuery);
                sinon.assert.calledOnce(dsStub.runQuery);
                data.entities.should.be.deep.equal(entities);
                done();
            }).catch(function (error) {
                throw error;
            });
    });
});

describe('Run Transaction', function() {
    it('should fail to run the transaction', function(done) {
        const transactionStub = {
            run: sandbox.stub().callsFake(function(callback) {
                callback(new Error());
            }),
            commit: sandbox.stub(),
            delete: sandbox.stub(),
            rollback: sandbox.stub(),
            save: sandbox.stub(),
        };
        datastore.transactionRun(transactionStub, 'save', {})
            .then(() => {
                throw new Error('Expected transaction to fail.');
            })
            .catch((error) => {
                should.exist(error);
                sinon.assert.calledOnce(transactionStub.run);
                done();
            });
    });
    it('should fail because the operation is invalid', function(done) {
        const transactionStub = {
            run: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            commit: sandbox.stub(),
            delete: sandbox.stub(),
            rollback: sandbox.stub(),
            save: sandbox.stub(),
        };
        datastore.transactionRun(transactionStub, 'wrong-operation', {})
            .then(() => {
                throw new Error('Expected transaction to fail.');
            })
            .catch((error) => {
                should.exist(error);
                sinon.assert.calledOnce(transactionStub.run);
                done();
            });
    });
    it('should fail to commit the transaction', function(done) {
        const testEntities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            }
        ];
        const transactionStub = {
            commit: sandbox.stub().callsFake(function(callback) {
                callback(new Error());
            }),
            run: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            delete: sandbox.stub(),
            rollback: sandbox.stub(),
            save: sandbox.stub(),
        };
        datastore.transactionRun(transactionStub, 'save', testEntities)
            .then(() => {
                throw new Error('Expected transaction to fail.');
            })
            .catch((error) => {
                should.exist(error);
                sinon.assert.calledOnce(transactionStub.run);
                sinon.assert.calledOnce(transactionStub.save);
                sinon.assert.calledWith(transactionStub.save, testEntities);
                sinon.assert.calledOnce(transactionStub.commit);
                done();
            });
    });
    it('should successfully run a save transaction', function(done) {
        const testEntities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            }
        ];
        const transactionStub = {
            commit: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            run: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            delete: sandbox.stub(),
            rollback: sandbox.stub(),
            save: sandbox.stub(),
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
            .catch((error) => {
                throw error;
            });
    });
    it('should successfully run a delete transaction', function(done) {
        const testEntities = [
            {
                float: 6.0,
            },
            {
                string: 'string',
            }
        ];
        const transactionStub = {
            commit: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            run: sandbox.stub().callsFake(function(callback) {
                callback();
            }),
            delete: sandbox.stub(),
            rollback: sandbox.stub(),
            save: sandbox.stub(),
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
            .catch((error) => {
                throw error;
            });
    });
});

describe('Save Entities', function() {
    it('should fail to save entities', function(done) {
        const keys = [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}];
        const entities = [
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
        const rollbackStub = sandbox.stub();
        const dsStub = {
            transaction: sandbox.stub().returns(
                    { rollback: rollbackStub }
                )
        };
        datastore.ds = dsStub;
        datastore.transactionRun = sinon.stub().returnsPromise().rejects(new Error('Failed to save entities.'));
        datastore.saveEntities({
            keys: keys,
            entities: entities
        }).then(function () {
            throw new Error('Expected transaction to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.calledOnce(dsStub.transaction);
            sinon.assert.called(rollbackStub);
            done();
        });
    });
    it('should successfully save entities', function(done) {
        const keys = [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}];
        const entities = [
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
        const rollbackStub = sandbox.stub();
        const dsStub = {
            transaction: sandbox.stub().returns(
                    { rollback: rollbackStub }
                )
        };
        datastore.ds = dsStub;
        datastore.transactionRun = sinon.stub().returnsPromise().resolves();
        datastore.saveEntities({
            keys: keys,
            entities: entities
        }).then(function () {
            sinon.assert.calledOnce(dsStub.transaction);
            sinon.assert.notCalled(rollbackStub);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
});

describe('Write Multiple', function() {
    it('should fail write multiple entities to datastore', function(done) {
        const key = 'key';
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
        const dsStub = {
            key: sandbox.stub().returns(key)
        };
        datastore.ds = dsStub;
        datastore.saveEntities = sinon.stub().returnsPromise().rejects(new Error('Failed to save entities.'));
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            ids: localIds,
            entities: entities,
            excludeFromIndexes: ['boolean', 'date', 'int', 'string']
        }).then(function () {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.calledOnce(datastore.saveEntities);
            sinon.assert.callCount(dsStub.key, 4);
            done();
        });
    });
    it('should write multiple entities to datastore', function(done) {
        const key = 'key';
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
        const dsStub = {
            key: sandbox.stub().returns(key)
        };
        datastore.ds = dsStub;
        datastore.saveEntities = sinon.stub().returnsPromise().resolves(entities);
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            ids: localIds,
            entities: entities,
            excludeFromIndexes: ['boolean', 'date', 'int', 'string']
        }).then(function (savedEntities) {
            savedEntities.should.be.a('array');
            savedEntities.should.be.deep.equal(entities);
            sinon.assert.calledOnce(datastore.saveEntities);
            sinon.assert.callCount(dsStub.key, 4);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
    it('should fail to allocate IDs for the entities', function(done) {
        const key = 'key';
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
        const dsStub = {
            key: sandbox.stub().returns(key),
            allocateIds: sinon.stub().returnsPromise().rejects(new Error('Failed to allocate IDs.'))
        };
        datastore.ds = dsStub;
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            entities: entities
        }).then(function () {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.calledOnce(dsStub.key);
            sinon.assert.calledOnce(dsStub.allocateIds);
            done();
        });
    });
    it('should fail to write multiple entities to datastore, after generating indexes', function(done) {
        const key = 'key';
        const localIds = ['1', '2', '3', '4'];
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
        const dsStub = {
            key: sandbox.stub().returns(key),
            allocateIds: sinon.stub().returnsPromise().resolves([localIds])
        };
        datastore.ds = dsStub;
        datastore.saveEntities = sinon.stub().returnsPromise().rejects(new Error('Failed to save entities.'));
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            entities: entities
        }).then(function () {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.calledOnce(dsStub.key);
            sinon.assert.calledOnce(dsStub.allocateIds);
            sinon.assert.calledOnce(datastore.saveEntities);
            done();
        });
    });
    it('should write multiple entities to datastore, automatically generating indexes for them', function(done) {
        const key = 'key';
        const localIds = ['1', '2', '3', '4'];
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
        const dsStub = {
            key: sandbox.stub().returns(key),
            allocateIds: sinon.stub().returnsPromise().resolves([localIds])
        };
        datastore.ds = dsStub;
        datastore.saveEntities = sinon.stub().returnsPromise().resolves(entities);
        datastore.writeMultiple({
            kind: kind,
            namespace: namespace,
            entities: entities
        }).then(function () {
            sinon.assert.calledOnce(dsStub.key);
            sinon.assert.calledOnce(dsStub.allocateIds);
            sinon.assert.calledOnce(datastore.saveEntities);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
});

describe('Delete Multiple', function() {
    it('should fail to delete entities', function(done) {
        const key = 'key';
        const ids = [1, 2, 3, 4, 5, 6];
        const rollbackStub = sandbox.stub();
        const dsStub = {
            key: sandbox.stub().returns(key),
            transaction: sandbox.stub().returns(
                    {rollback: rollbackStub}
                )
        };
        datastore.ds = dsStub;
        datastore.transactionRun = sinon.stub().returnsPromise().rejects(new Error('Failed to delete entities.'));
        datastore.deleteMultiple({
            ids: ids,
            kind: kind,
            namespace: namespace
        }).then(function () {
            throw new Error('Expected operation to fail.');
        }).catch(function (error) {
            should.exist(error);
            sinon.assert.calledOnce(dsStub.transaction);
            sinon.assert.called(rollbackStub);
            done();
        });
    });
    it('should successfully delete entities', function(done) {
        const key = 'key';
        const ids = [1, 2, 3, 4, 5, 6];
        const rollbackStub = sandbox.stub();
        const dsStub = {
            key: sandbox.stub().returns(key),
            transaction: sandbox.stub().returns(
                    {rollback: rollbackStub}
                )
        };
        datastore.ds = dsStub;
        datastore.transactionRun = sinon.stub().returnsPromise().resolves();
        datastore.deleteMultiple({
            ids: ids,
            kind: kind,
            namespace: namespace
        }).then(function () {
            sinon.assert.calledOnce(dsStub.transaction);
            sinon.assert.notCalled(rollbackStub);
            done();
        }).catch(function (error) {
            throw error;
        });
    });
});