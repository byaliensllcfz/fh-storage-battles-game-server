'use strict';

const Datastore = require('@google-cloud/datastore');
const config    = require('../config');

var ds;
if (process.env.environment === 'emulated') {
    // Emulated datastore
    ds = Datastore({
        projectId: config.GCLOUD_PROJECT,
        apiEndpoint: 'localhost:8081'
    });
} else {
    ds = Datastore({
        projectId: config.GCLOUD_PROJECT
    });
}

/**
 * Converts strings that represent integers to "Number" type.
 * This is necessary because Datastore always returns entity IDs as strings, even when they are actually numbers.
 * @param  {(number|string)} id Datastore entity ID.
 * @return {(number|string)}    Entity ID converted to number if it's a positive integer.
 */
function getId(id) {
    return /^\d+$/.test(id) ? parseInt(id, 10) : id;
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
function fromDatastore (obj) {
    obj.id = obj[Datastore.KEY].name || getId(obj[Datastore.KEY].id);
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
function toDatastore (obj, nonIndexed) {
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
function read(params) {
    const key = ds.key({
        namespace: params.namespace,
        path: [params.kind, getId(params.id)]
    });

    ds.get(key, (err, entity) => {
        if (err) {
            params.callback(err, entity);
            return;
        }
        if (!entity) {
            params.callback('Not found', 'Not found');
            return;
        }
        params.callback(err, fromDatastore(entity));
    });
}

/**
 * Save an entity to datastore.
 * @param {Object}   params
 * @param {String}   [params.id]               ID of the entity. If not provided will be automatically generated.
 * @param {String}   params.kind               Entity kind.
 * @param {String}   params.namespace          Entity namespace.
 * @param {Object}   params.data               Entity data.
 * @param {Array}    params.excludeFromIndexes Array of properties that should not be indexed.
 * @param {Function} params.callback
 */
function write(params) {
    var key;
    if (params.id) {
        params.id = getId(params.id);
        key = ds.key({
            namespace: params.namespace,
            path: [params.kind, params.id]
        });
    } else {
        key = ds.key({
            namespace: params.namespace,
            path: [params.kind]
        });
    }

    const entity = {
        key: key,
        data: toDatastore(params.data, params.excludeFromIndexes)
    };

    ds.save(
        entity,
        (err, entity) => {
            params.data.id = params.id || getId(entity.mutationResults[0].key.path[0].id);
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
function del(params) {
    const key = ds.key({
        namespace: params.namespace,
        path: [params.kind, getId(params.id)]
    });

    ds.delete(
        key,
        (err) => {
            params.callback(err);
        }
    );
}

/**
 * Creates a datastore transaction for the given namespace and kind.
 */
function createQuery(namespace, kind) {
    return ds.createQuery(namespace, kind);
}

/**
 * Run a Datastore query and calls the callback function with the query results.
 * @param {Object}   query    Datastore query to be run.
 * @param {Function} callback Function to be called after the operation finishes.
 */
function runQuery(query, callback) {
    ds.runQuery(
        query,
        function(err, entities, info) {
            if (err) {
                callback(err);
            } else {
                var data = {};
                data.entities = [];
                entities.forEach((entity) => {
                    data.entities.push(fromDatastore(entity));
                });
                // Check if  more results may exist.
                if (info.moreResults !== ds.NO_MORE_RESULTS) {
                    data.more = info.endCursor;
                }
                callback(err, data);
            }
        }
    );
}

/**
 * @param {Object}   transaction               Datastore transaction
 * @param {Object}   params
 * @param {Array}    params.keys               Array of datastore keys.
 * @param {Array}    params.entities           Array of entity data to be stored.
 * @param {Array}    params.excludeFromIndexes Array of properties that should not be indexed.
 * @param {Function} params.callback
 */
function saveEntities(params) {
    var entity;
    var entities = [];
    params.entities.forEach((data, i) => {
        entity = {
            key: params.keys[i],
            data: toDatastore(data, params.excludeFromIndexes)
        };
        entities.push(entity);
        params.entities[i].id = params.keys[i].id;
    });
    var transaction = ds.transaction();
    transaction.run(function(err) {
        if (err) {
            transaction.rollback();
            params.callback(err, params.entities);
        } else {
            transaction.save(entities);
            transaction.commit(function(err) {
                if (err) {
                    transaction.rollback();
                }
                params.callback(err, params.entities);
            });
        }
    });
}

/**
 * Save multiple entities to datastore using a single transaction.
 * @param {Object}   params
 * @param {Array}    [params.ids]              Optional array of entity IDs.
 * @param {String}   params.kind               Entities kind.
 * @param {String}   params.namespace          Entities namespace.
 * @param {Array}    params.entities           Array of entity data to be stored.
 * @param {Array}    params.excludeFromIndexes Array of properties that should not be indexed.
 * @param {Function} params.callback
 */
function writeMultiple(params) {
    var key;
    var keys = [];
    if (params.ids) {
        params.ids.forEach(id => {
            key = ds.key({
                namespace: params.namespace,
                path: [params.kind, getId(id)]
            });
            keys.push(key);
        });
        params.keys = keys;
        saveEntities(params);
    } else {
        var incompleteKey = ds.key({
            namespace: params.namespace,
            path: [params.kind]
        });
        ds.allocateIds(incompleteKey, params.entities.length)
            .then(function(data) {
                params.keys = data[0];
                saveEntities(params);
            })
            .catch(function(err) {
                params.callback(err);
            });
    }
}

/**
 * Delete multiple entities from datastore using a single transaction.
 * @param {Object}   params
 * @param {Array}    params.ids                Array of entity IDs.
 * @param {String}   params.kind               Entities kind.
 * @param {String}   params.namespace          Entities namespace.
 * @param {Function} params.callback
 */
function deleteMultiple(params) {
    var key;
    var keys = [];
    params.ids.forEach(id => {
        key = ds.key({
            namespace: params.namespace,
            path: [params.kind, getId(id)]
        });
        keys.push(key);
    });
    var transaction = ds.transaction();
    transaction.run(function(err) {
        if (err) {
            transaction.rollback();
            params.callback(err, params.ids);
        } else {
            transaction.delete(keys);
            transaction.commit(function(err) {
                if (err) {
                    transaction.rollback();
                }
                params.callback(err, params.ids);
            });
        }
    });
}

module.exports = {
    createQuery,
    del,
    deleteMultiple,
    read,
    runQuery,
    write,
    writeMultiple
};