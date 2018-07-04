'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const config = require('../config');
const fs = require('fs');
chai.use(chaiHttp);
chai.should();

function successChecks(err, res, status) {
    if (res.statusCode !== status) {
        console.error(res.body); // eslint-disable-line no-console
    }
    if (err) {
        throw err;
    }
    res.should.have.status(status);
}

function errorChecks(err, res, status) {
    const expected = {
        status: status,
        type: res.body.type ? res.body.type : 'Invalid',
        title: res.body.title ? res.body.title : 'Invalid',
        detail: res.body.detail ? res.body.detail : 'Invalid',
    };
    res.body.should.be.deep.equal(expected);
    if (err) {
        throw err;
    }
}

function importTest(name, path) {
    describe(name, function() {
        require(path);
    });
}

function deleteLogs(done) {
    const path = '/var/log/app_engine/custom_logs/';
    fs.readdir(path, (error, files) => {
        if (error) {
            done(error);
        }
        const fileBaseName = `app-${config.service_name}-`;
        const matcher = new RegExp(fileBaseName + '.*');
        const matchedFiles = files.filter(name => matcher.test(name));
        matchedFiles.forEach(filename => {
            fs.unlink(path + filename, error => {
                done(error);
            });
        });
        done();
    });
}

function assertDatastoreKey(datastore, object) {
    return datastore.read(object)
        .catch(error => {
            if (process.env.DATASTORE_EMULATOR_HOST) {
                const uuid = require('uuid/v4');
                object.data = {
                    key: uuid(),
                };
                return datastore.write(object);
            } else {
                throw error;
            }
        });
}

function systemTestSetup(config, done) {
    global.baseHeaders = {
        'content-type': 'application/json',
    };
    const tpCommon = require('tp-common');
    const datastore = new tpCommon.Datastore(config);
    const promises = [];
    const serviceAccountKey = {
        id: 'adminkey',
        kind: 'ServiceAccountKeys',
        namespace: config.service_name,
    };
    const sharedCloudSecret = {
        id: 'latest',
        kind: 'SharedCloudSecret',
        namespace: 'cloud-configs',
    };
    promises.push(assertDatastoreKey(datastore, serviceAccountKey));
    promises.push(assertDatastoreKey(datastore, sharedCloudSecret));
    Promise.all(promises).then(([serviceAccountKey, sharedCloudSecret]) => {
        global.baseHeaders['x-tapps-service-account-key'] = serviceAccountKey;
        global.serviceAccountKey = serviceAccountKey;
        global.baseHeaders['x-tapps-shared-cloud-secret'] = sharedCloudSecret;
        global.sharedCloudSecret = sharedCloudSecret;
        done();
    }).catch(done);
}

module.exports = {
    deleteLogs,
    errorChecks,
    importTest,
    successChecks,
    systemTestSetup,
};
