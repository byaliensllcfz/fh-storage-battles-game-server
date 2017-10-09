'use strict';

var newrelic  = require('newrelic');
var stringify = require('json-stringify-safe');

const config  = require('../config');
const headers = require('../config/tapps-headers');
var logger  = require('./logger');

const fieldsToLog = ['body', 'headers', 'hostname', 'ip', 'ips', 'method', 'originalUrl', 'params', 'query'];

const errors = {
    '40000': 'Bad Request',
    '40001': 'Missing Request Headers',
    '40002': 'Bad Template Parameters',
    '40003': 'Bad Query Parameters',
    '40004': 'Write to Datastore Failed',
    '40005': 'Datastore Update Failed',
    '40300': 'Forbidden',
    '40400': 'Not Found',
    '40401': 'Datastore Entity Not Found',
    '40500': 'Method Not Allowed',
    '42200': 'Unprocessable Entity',
    '50000': 'Internal Error',
    '50001': 'Failed to Read from Datastore'
};

function getErrorUrl(req, type) {
    return '/' + config.NAME +  '/v1/errors/' + type;
}

function replaceErrors(value) {
    if (value instanceof Error) {
        var error = {};
        Object.getOwnPropertyNames(value).forEach(key => {
            error[key] = value[key];
        });
        return error;
    }
    return value;
}

function mergeResponse(req, info) {
    var reqCopy = {};
    for (var field in req) {
        if (fieldsToLog.indexOf(field) !== -1) {
            reqCopy[field] = req[field];
        }
    }
    if (reqCopy.hasOwnProperty('headers')){
        // It's safe to delete a property even if it does not exist
        delete reqCopy.headers[headers['shared-cloud-secret']];
        delete reqCopy.headers[headers['game-user-id-token']];
        delete reqCopy.headers[headers['cross-app-user-id-token']];
        delete reqCopy.headers[headers['service-account-key']];
    }
    var logMessage = {};
    logMessage.request = JSON.parse(stringify(reqCopy));
    logMessage.response = replaceErrors(info);
    newrelic.addCustomParameters(logMessage);
    return logMessage;
}

function errorResponse(req, res, type, error) {
    var responseJson = {};
    var code = ~~(type/100);  // Gets only the integer part
    responseJson.type = getErrorUrl(req, type);
    responseJson.status = code;
    // If a title was not defined for that error type use the default title for that status code.
    responseJson.title = errors[type] || errors[code * 100];
    responseJson.detail = error;
    if (type !== 40400) {
        var logMessage = mergeResponse(req, responseJson);
        if (code >= 500 && code < 600) {
            logger.error(logMessage);
        } else {
            logger.info(logMessage);
        }
    }
    if (type === 40300) {
        responseJson.detail = 'Forbidden';
    }
    res.contentType('application/problem+json');
    res.status(code).send(JSON.stringify(responseJson));
}

function successResponse(req, res, status, data) {
    var responseJson = {};
    responseJson.status = status;
    responseJson.data = data;
    var logMessage = mergeResponse(req, responseJson);
    logger.info(logMessage);
    res.status(status).send(data);
}

module.exports = {
    errorResponse,
    mergeResponse,
    successResponse
};