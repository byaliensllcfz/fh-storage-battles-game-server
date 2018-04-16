'use strict';

const DB_OPS = [
    'createQuery',
    'key',
    'transaction',
];

const CLIENT_OPS = [
    'allocateIds',
    'beginTransaction',
    'commit',
    'getProjectId',
    'lookup',
    'reserveIds',
    'rollback',
    'runQuery',
];

const REQUEST_OPS = [
    'allocateIds',
    'createReadStream',
    'delete',
    'get',
    'insert',
    'runQuery',
    'runQueryStream',
    'save',
    'update',
    'upsert',
    'request_',
];

const QUERY_OPS = [
    'filter',
    'hasAncestor',
    'order',
    'groupBy',
    'select',
    'start',
    'end',
    'limit',
    'offset',
    'run',
    'runStream',
];

const TRANSACTION_OPS = [
    'commit',
    'createQuery',
    'delete',
    'rollback',
    'run',
    'save',
];

function recordOperations(shim, datastoreObject, operations) {
    if (datastoreObject && datastoreObject.prototype) {
        let proto = datastoreObject.prototype;
        for (let i = operations.length - 1; i >= 0; i--) {
            shim.recordOperation(proto, operations[i], {name: operations[i], callback: shim.LAST});
        }
    }
}

function recordQueries(shim, datastoreObject, operations) {
    if (datastoreObject && datastoreObject.prototype) {
        let queryProto = datastoreObject.prototype;
        for (let i = operations.length - 1; i >= 0; i--) {
            shim.recordQuery(queryProto, operations[i], {name: operations[i], callback: shim.LAST});
        }
    }
}

function instrument(shim, datastore) {
    shim.setDatastore('Datastore');

    recordOperations(shim, datastore, DB_OPS);
    recordOperations(shim, datastore.DatastoreRequest, REQUEST_OPS);
    recordOperations(shim, datastore.Transaction, TRANSACTION_OPS);
    recordOperations(shim, datastore.v1.DatastoreClient, CLIENT_OPS);
    recordQueries(shim, datastore.Query, QUERY_OPS);
}

module.exports = instrument;
