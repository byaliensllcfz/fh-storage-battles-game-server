"use strict";

var bunyan = require("bunyan");
var logging = require("@google-cloud/logging");
var mkdirp = require("mkdirp");
var newrelic = require("newrelic");
var stringify = require("json-stringify-safe");

const config = require("../config");
const headers = require("../config/tapps-headers");

const excludeFromLogs = ["app", "client", "connection", "_events", "host", "rawHeaders", "res", "socket"];

const errors = {
    "40000": "Bad Request",
    "40001": "Missing Request Headers",
    "40300": "Forbidden",
    "40400": "Not Found",
    "40500": "Method Not Allowed",
    "42200": "Unprocessable Entity",
    "50000": "Internal Error"
};

const loggingClient = logging({
    projectId: config.GCLOUD_PROJECT
});
const log = loggingClient.log(config.NAME + "-logs");

mkdirp.sync("/var/log/app_engine/custom_logs");
var bunyanLog = bunyan.createLogger({
    name: config.NAME,
    src: true,
    streams: [
        {
            type: 'rotating-file',
            period: '1d',
            count: 5,
            path: "/var/log/app_engine/custom_logs/app-" + config.NAME +  "-info.json",
            level: "info"
        },
        {
            type: 'rotating-file',
            period: '1d',
            count: 5,
            path: "/var/log/app_engine/custom_logs/app-" + config.NAME +  "-error.json",
            level: "error"
        },
        {
            type: 'rotating-file',
            period: '1d',
            count: 5,
            path: "/var/log/app_engine/custom_logs/app-" + config.NAME +  "-fatal.json",
            level: "fatal"
        }
    ]
});

function logNotice(params) {
    var entry = log.entry(params);
    log.notice(entry, function(err, apiResponse) {});
    bunyanLog.info(params);
}

function logInfo(params) {
    var entry = log.entry(params);
    log.info(entry, function(err, apiResponse) {});
    bunyanLog.info(params);
}

function logError(params) {
    var entry = log.entry(params);
    log.error(entry, function(err, apiResponse) {});
    bunyanLog.error(params);
}

function logAlert(params) {
    var entry = log.entry(params);
    log.alert(entry, function(err, apiResponse) {});
    bunyanLog.fatal(params);
}

function getErrorUrl(req, type) {
    return "/" + config.NAME +  "/v1/errors/" + type;
}

function mergeResponse(req, responseObject) {
    var reqCopy = {};
    for (var field in req) {
        if (excludeFromLogs.indexOf(field) === -1) {
            reqCopy[field] = req[field];
        }
    }
    if (reqCopy.hasOwnProperty("headers")){
        // It"s safe to delete a property even if it does not exist
        delete reqCopy.headers[headers["shared-cloud-secret"]];
        delete reqCopy.headers[headers["game-user-id-token"]];
        delete reqCopy.headers[headers["cross-app-user-id-token"]];
        delete reqCopy.headers[headers["service-account-key"]];
    }
    var logMessage = {};
    logMessage.request = JSON.parse(stringify(reqCopy));
    logMessage.response = responseObject;
    return logMessage;
}

function errorResponse(req, res, type, error) {
    var responseJson = {};
    var code = ~~(type/100);  // Gets only the integer part
    responseJson.type = getErrorUrl(req, type);
    responseJson.status = code;
    responseJson.title = errors[type];
    responseJson.detail = error;
    if (type !== 40400) {
        var logMessage = mergeResponse(req, responseJson);
        var entry = log.entry(logMessage);
        if (code >= 500 && code < 600) {
            logError(entry, function(err, apiResponse) {});
        } else {
            logInfo(entry, function(err, apiResponse) {});
        }
        for (var field in logMessage) {
            for (var param in logMessage[field]) {
                newrelic.addCustomParameter(field + "." + param, stringify(logMessage[field][param]));
            }
        }
    }
    if (type === 40300) {
        responseJson.detail = "Forbidden";
    }
    res.contentType("application/problem+json");
    res.status(code).send(JSON.stringify(responseJson));
}

module.exports = {
    errorResponse,
    logAlert,
    logError,
    logInfo,
    logNotice,
    mergeResponse
};