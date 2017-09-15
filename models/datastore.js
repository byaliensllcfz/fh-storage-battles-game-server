'use strict';

var gcloudDatastore = require('@google-cloud/datastore');
const config        = require('../config');

class Datastore{

    constructor(){
        if (process.env.DATASTORE_TYPE ==='emulated') {
            // Emulated datastore
            this.ds = gcloudDatastore({
                projectId: process.env.DATASTORE_PROJECT_ID || config.GCLOUD_PROJECT,
                apiEndpoint: process.env.DATASTORE_EMULATOR_HOST || 'localhost:8081'
            });
        } else {
            this.ds = gcloudDatastore({
                projectId: process.env.DATASTORE_PROJECT_ID || config.GCLOUD_PROJECT
            });
        }
    }

    /**
     * Converts strings that represent integers to "Number" type.
     * This is necessary because Datastore always returns entity IDs as strings, even when they are actually numbers.
     * @param  {(number|string)} id Datastore entity ID.
     * @return {(number|string)}    Entity ID converted to number if it's a positive integer.
     */
    getId(id) {
        return /^\d+$/.test(id) ? gcloudDatastore.int(id) : id;
    }

    // Translates from Datastore's entity format to
    // the format expected by the application.
    //
    // Datastore format:
    //   {
    //     key: [kind, id],
    //     data: {
    //       property: value
    //     }
    //   }
    //
    // Application format:
    //   {
    //     id: id,
    //     property: value
    //   }
    fromDatastore (obj) {
        obj.id = obj[gcloudDatastore.KEY].name || obj[gcloudDatastore.KEY].id;
        return obj;
    }

    // Translates from the application's format to the datastore's
    // extended entity property format. It also handles marking any
    // specified properties as non-indexed. Does not translate the key.
    //
    // Application format:
    //   {
    //     id: id,
    //     property: value,
    //     unindexedProperty: value
    //   }
    //
    // Datastore extended format:
    //   [
    //     {
    //       name: property,
    //       value: value
    //     },
    //     {
    //       name: unindexedProperty,
    //       value: value,
    //       excludeFromIndexes: true
    //     }
    //   ]
    toDatastore (obj, nonIndexed) {
        nonIndexed = nonIndexed || [];
        const results = [];
        Object.keys(obj).forEach((k) => {
            if (obj[k] !== undefined) {
                if (Array.isArray(obj[k]) && nonIndexed.indexOf(k) > -1) {
                    obj[k].forEach((field, i) => {
                        results.push({
                            name: k,
                            value: field,
                            excludeFromIndexes: true
                        });
                    });
                }
                results.push({
                    name: k,
                    value: obj[k],
                    excludeFromIndexes: (nonIndexed.indexOf(k) > -1)
                });
            }
        });
        return results;
    }

    /**
     * Read an entity from datastore.
     * @param {Object}   params
     * @param {String}   params.id        ID of the entity.
     * @param {String}   params.kind      Entity kind.
     * @param {String}   params.namespace Entity namespace.
     * @param {Function} params.callback
     */
    read(params) {
        const key = this.ds.key({
            namespace: params.namespace,
            path: [params.kind, this.getId(params.id)]
        });

        this.ds.get(key, (err, entity) => {
            if (err) {
                params.callback(err, entity);
                return;
            }
            if (!entity) {
                params.callback(new Error('Not found'), 'Not found');
                return;
            }
            params.callback(err, this.fromDatastore(entity));
        });
    }

    /**
     * Save an entity to datastore.
     * @param {Object}   params
     * @param {String}   [params.id]                 ID of the entity. If not provided will be automatically generated.
     * @param {String}   params.kind                 Entity kind.
     * @param {String}   params.namespace            Entity namespace.
     * @param {Object}   params.data                 Entity data.
     * @param {Array}    [params.excludeFromIndexes] Optional array of properties that should not be indexed.
     * @param {Function} params.callback
     */
    write(params) {
        var key;
        if (params.id) {
            key = this.ds.key({
                namespace: params.namespace,
                path: [params.kind, this.getId(params.id)]
            });
        } else {
            key = this.ds.key({
                namespace: params.namespace,
                path: [params.kind]
            });
        }

        const entity = {
            key: key,
            data: this.toDatastore(params.data, params.excludeFromIndexes)
        };

        this.ds.save(
            entity,
            (err, entity) => {
                params.data.id = params.id || entity.mutationResults[0].key.path[0].id;
                params.callback(err, params.data);
            }
        );
    }

    /**
     * Delete an entity from datastore.
     * @param {Object}   params
     * @param {String}   params.id        ID of the entity.
     * @param {String}   params.kind      Entity kind.
     * @param {String}   params.namespace Entity namespace.
     * @param {Function} params.callback
     */
    del(params) {
        const key = this.ds.key({
            namespace: params.namespace,
            path: [params.kind, this.getId(params.id)]
        });

        this.ds.delete(
            key,
            (err) => {
                params.callback(err);
            }
        );
    }

    /**
     * Creates a datastore transaction for the given namespace and kind.
     */
    createQuery(namespace, kind) {
        return this.ds.createQuery(namespace, kind);
    }

    /**
     * Run a Datastore query and calls the callback function with the query results.
     * @param {Object}   query    Datastore query to be run.
     * @param {Function} callback Function to be called after the operation finishes.
     */
    runQuery(query, callback) {
        this.ds.runQuery(
            query,
            (err, entities, info) => {
                if (err) {
                    callback(err);
                } else {
                    var data = {};
                    data.entities = [];
                    entities.forEach((entity) => {
                        data.entities.push(this.fromDatastore(entity));
                    });
                    // Check if  more results may exist.
                    if (info.moreResults != gcloudDatastore.NO_MORE_RESULTS && info.endCursor != 'CgA=') {
                        data.more = info.endCursor;
                    }
                    callback(err, data);
                }
            }
        );
    }

    /**
     * Converts Datastore.transaction.run to a promise, so multiple transactions can be run simultaneously.
     * @param  {Object}  transaction Datastore transaction.
     * @param  {Array}   entities    Array of entities to be saved.
     * @return {Promise}             Promise that will be resolved or rejected depending on the transaction result.
     */
    transactionRun(transaction, operation, entities) {
        return new Promise((resolve, reject) => {
            transaction.run(function(err) {
                if (err) {
                    transaction.rollback();
                    reject(err);
                } else {
                    if (operation === 'save') {
                        transaction.save(entities);
                    } else if (operation === 'delete') {
                        transaction.delete(entities);
                    } else {
                        transaction.rollback();
                        reject('Invalid operation.');
                    }
                    transaction.commit(function(err) {
                        if (err) {
                            transaction.rollback();
                            reject(err);
                        } else {
                            resolve(entities);
                        }
                    });
                }
            });
        });
    }

    /**
     * @param {Object}   transaction               Datastore transaction.
     * @param {Object}   params
     * @param {Array}    params.keys               Array of datastore keys.
     * @param {Array}    params.entities           Array of entity data to be stored.
     * @param {Array}    params.excludeFromIndexes Array of properties that should not be indexed.
     * @param {Function} params.callback
     */
    saveEntities(params) {
        var entity;
        var entities = [];
        params.entities.forEach((data, i) => {
            entity = {
                key: params.keys[i],
                data: this.toDatastore(data, params.excludeFromIndexes)
            };
            entities.push(entity);
            params.entities[i].id = params.keys[i].id;
        });
        var promises = [];
        var transactions = [];
        var tempEntities;
        var originalLength = entities.length;
        for (var i = 0; i < originalLength; i+=25) {
            // Get 25 entities at a time, because that's the limit of entity modifications per transaction.
            tempEntities = entities.splice(0, 25);
            var transaction = this.ds.transaction();
            // Store the transactions so they can be rolled back if one of them fails.
            transactions.push(transaction);
            var promise = this.transactionRun(transaction, 'save', tempEntities);
            promises.push(promise);
        }
        Promise.all(promises).then(values => {
            // All transactions succeeded.
            params.callback(null, params.entities);
        }).catch((err) => {
            // One of the transactions failed. All of them have to be rolled back.
            transactions.forEach(transaction => {
                transaction.rollback();
            });
            params.callback(err, params.entities);
        });
    }

    /**
     * Save multiple entities to datastore using a single transaction.
     * @param {Object}   params
     * @param {Array}    [params.ids]                Optional array of entity IDs.
     * @param {String}   params.kind                 Entities kind.
     * @param {String}   params.namespace            Entities namespace.
     * @param {Array}    params.entities             Array of entity data to be stored.
     * @param {Array}    [params.excludeFromIndexes] Optional array of properties that should not be indexed.
     * @param {Function} params.callback
     */
    writeMultiple(params) {
        var key;
        var keys = [];
        if (params.ids) {
            params.ids.forEach(id => {
                key = this.ds.key({
                    namespace: params.namespace,
                    path: [params.kind, this.getId(id)]
                });
                keys.push(key);
            });
            params.keys = keys;
            this.saveEntities(params);
        } else {
            var incompleteKey = this.ds.key({
                namespace: params.namespace,
                path: [params.kind]
            });
            this.ds.allocateIds(incompleteKey, params.entities.length)
                .then((data) => {
                    params.keys = data[0];
                    this.saveEntities(params);
                })
                .catch((err) => {
                    params.callback(err);
                });
        }
    }

    /**
     * Delete multiple entities from datastore using a single transaction.
     * @param {Object}   params
     * @param {Array}    params.ids       Array of entity IDs.
     * @param {String}   params.kind      Entities kind.
     * @param {String}   params.namespace Entities namespace.
     * @param {Function} params.callback
     */
    deleteMultiple(params) {
        var key;
        var keys = [];
        params.ids.forEach(id => {
            key = this.ds.key({
                namespace: params.namespace,
                path: [params.kind, this.getId(id)]
            });
            keys.push(key);
        });
        var promises = [];
        var transactions = [];
        var tempKeys;
        var originalLength = keys.length;
        for (var i = 0; i < originalLength; i+=25) {
            // Get 25 entities at a time, because that's the limit of entity modifications per transaction.
            tempKeys = keys.splice(0, 25);
            var transaction = this.ds.transaction();
            // Store the transactions so they can be rolled back if one of them fails.
            transactions.push(transaction);
            var promise = this.transactionRun(transaction, 'delete', tempKeys);
            promises.push(promise);
        }
        Promise.all(promises).then(values => {
            // All transactions succeeded.
            params.callback(null, params.ids);
        }).catch((err) => {
            // One of the transactions failed. All of them have to be rolled back.
            transactions.forEach(transaction => {
                transaction.rollback();
            });
            params.callback(err, params.ids);
        });
    }
}

module.exports = Datastore;