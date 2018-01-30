'use strict';

const DB_OPS = [
    'createQuery',
    'key',
    'transaction'
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
    'request_'
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
    'runStream'
];

const TRANSACTION_OPS = [
    'commit',
    'createQuery',
    'delete',
    'rollback',
    'run',
    'save'
];

function instrument(shim, datastore, moduleName) {
    shim.setDatastore('Datastore');

    if (datastore && datastore.prototype) {
        let proto = datastore.prototype;
        for (let i = DB_OPS.length - 1; i >= 0; i--) {
            shim.recordOperation(proto, DB_OPS[i], {name: DB_OPS[i], callback: shim.LAST});
        }
    }

    if (datastore.DatastoreRequest && datastore.DatastoreRequest.prototype) {
        let requestProto = datastore.DatastoreRequest.prototype;
        for (let i = REQUEST_OPS.length - 1; i >= 0; i--) {
            shim.recordOperation(requestProto, REQUEST_OPS[i], {name: REQUEST_OPS[i], callback: shim.LAST});
        }
    }

    if (datastore.Query && datastore.Query.prototype) {
        let queryProto = datastore.Query.prototype;
        for (let i = QUERY_OPS.length - 1; i >= 0; i--) {
            shim.recordQuery(queryProto, QUERY_OPS[i], {name: QUERY_OPS[i], query: QUERY_OPS[i], callback: shim.LAST});
        }
    }

    if (datastore.Transaction && datastore.Transaction.prototype) {
        let transactionProto = datastore.Transaction.prototype;
        for (let i = TRANSACTION_OPS.length - 1; i >= 0; i--) {
            shim.recordOperation(transactionProto, TRANSACTION_OPS[i], {
                name: TRANSACTION_OPS[i],
                callback: shim.LAST
            });
        }
    }
}

module.exports = instrument;
