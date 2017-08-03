'use strict';

const config = require('./config');
const logging = require('@google-cloud/logging');
const newrelic = require('newrelic');
const stringify = require('json-stringify-safe');

const loggingClient = logging({
    projectId: config['GCLOUD_PROJECT']
});
const log = loggingClient.log('auth-logs');

var bCryptSalt = '$2a$10$tOgwp0ZJrg1G8HHjZgPGV.';

const excludeFromLogs = ['client', 'connection', 'host', 'res', 'socket'];

function getErrorUrl(req, type) {
    return '/auth/v3/errors/' + type;
}

function mergeResponse(req, responseObject) {
    var reqCopy = {};
    for (var field in req) {
        if (excludeFromLogs.indexOf(field) === -1) {
            reqCopy[field] = req[field];
        }
    }
    if (reqCopy.hasOwnProperty('header')){
        // It's safe to delete a property even if it does not exist
        delete reqCopy.headers['x-tapps-shared-cloud-secret'];
        delete reqCopy.headers['x-tapps-game-user-id-token'];
        delete reqCopy.headers['x-tapps-cross-app-user-id-token'];
    }
    var logMessage = {};
    logMessage.request = JSON.parse(stringify(reqCopy));
    logMessage.response = responseObject;
    return logMessage;
}

function getUrlParam(url, param) {
    var urlArray = url.split('/');
    var index = urlArray.indexOf(param);
    return urlArray[index + 1];
}

function errorResponse(req, res, code, type, title, error) {
    var responseJson = {};
    responseJson.type = getErrorUrl(req, type);
    responseJson.status = code;
    responseJson.title = title;
    responseJson.detail = stringify(error);
    if (code != 404) {
        var logMessage = mergeResponse(req, responseJson);
        var entry = log.entry(logMessage);
        if (code >= 500 && code < 600) {
            log.error(entry, function(err, apiResponse) {});
        } else {
            log.info(entry, function(err, apiResponse) {});
        }
        for (var field in logMessage) {
            for (var param in logMessage[field]) {
                newrelic.addCustomParameter(field + "." + param, stringify(logMessage[field][param]));
            }
        }
    }
    res.contentType('application/problem+json');
    res.status(code).send(JSON.stringify(responseJson));
}

module.exports = {
    bCryptSalt,
    errorResponse,
    getUrlParam,
    log,
    mergeResponse
};