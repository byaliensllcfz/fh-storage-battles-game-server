"use strict";

const Datastore = require("@google-cloud/datastore");
const config = require("../config");

var ds;
if (process.env === "emulated") {
    // Emulated datastore
    ds = Datastore({
        projectId: "tpserver-dev-env",
        apiEndpoint: process.env.DATASTORE_EMULATOR_HOST
    });
} else {
    ds = Datastore({
        projectId: config.GCLOUD_PROJECT
    });
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
    obj.id = obj[Datastore.KEY].name;
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
        if (obj[k] === undefined) {
            return;
        }
        results.push({
            name: k,
            value: obj[k],
            excludeFromIndexes: (nonIndexed.indexOf(k) > -1)
        });
    });
    return results;
}

/**
 * @param {Object} params
 * @param {String} params.id ID of the entity.
 * @param {String} params.kind Entity kind.
 * @param {String} params.namespace Entity namespace.
 * @param {Function} params.callback
 * Function params.callback
 */
function read(params) {
    const key = ds.key({
        namespace: params.namespace,
        path: [params.kind, params.id]
    });

    ds.get(key, (err, entity) => {
        if (err) {
            params.callback(err, entity);
            return;
        }
        if (!entity) {
            params.callback(true, "Not found");
            return;
        }
        params.callback(err, fromDatastore(entity));
    });
}

/**
 * @param {Object} params
 * @param {String} [params.id] ID of the entity. If not provided will be automatically generated.
 * @param {String} params.kind Entity kind.
 * @param {String} params.namespace Entity namespace.
 * @param {Object} params.data Entity data.
 * @param {Array} params.excludeFromIndexes Array of properties that should not be indexed.
 * @param {Function} params.callback
 * Function params.callback
 */
function write(params) {
    var key;
    if (params.id) {
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
        (err) => {
            params.data.id = entity.key.name;
            params.callback(err, params.data);
        }
    );
}

/**
 * @param {Object} params
 * @param {String} params.id ID of the entity.
 * @param {String} params.kind Entity kind.
 * @param {String} params.namespace Entity namespace.
 * @param {Function} params.callback
 * Function params.callback
 */
function del(params) {
    const key = ds.key({
        namespace: params.namespace,
        path: [params.kind, params.id]
    });

    ds.delete(
        key,
        (err) => {
            params.callback(err);
        }
    );
}

module.exports = {
    read,
    write,
    del
};