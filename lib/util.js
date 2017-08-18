"use strict";

const logging = require("@google-cloud/logging");
const newrelic = require("newrelic");
const stringify = require("json-stringify-safe");

const config = require("../config");
const headers = require("../config/tapps-headers");

const loggingClient = logging({
    projectId: config["GCLOUD_PROJECT"]
});
const log = loggingClient.log("auth-client-api-logs");

const excludeFromLogs = ["client", "connection", "host", "res", "socket"];

const errors = {
    "40000": "Bad Request",
    "40300": "Forbidden",
    "40400": "Not Found",
    "40500": "Method Not Allowed",
    "42200": "Unprocessable Entity",
    "50000": "Internal Error"
};

function getErrorUrl(req, type) {
    return "/auth-client-api/v1/errors/" + type;
}

function mergeResponse(req, responseObject) {
    var reqCopy = {};
    for (var field in req) {
        if (excludeFromLogs.indexOf(field) === -1) {
            reqCopy[field] = req[field];
        }
    }
    if (reqCopy.hasOwnProperty("header")){
        // It"s safe to delete a property even if it does not exist
        delete reqCopy.headers[headers["shared-cloud-secret"]];
        delete reqCopy.headers[headers["game-user-id-token"]];
        delete reqCopy.headers[headers["cross-app-user-id-token"]];
    }
    var logMessage = {};
    logMessage.request = JSON.parse(stringify(reqCopy));
    logMessage.response = responseObject;
    return logMessage;
}

function getUrlParam(url, param) {
    var urlArray = url.split("/");
    var index = urlArray.indexOf(param);
    return urlArray[index + 1];
}

function errorResponse(req, res, code, type, error) {
    var responseJson = {};
    responseJson.type = getErrorUrl(req, type);
    responseJson.status = code;
    responseJson.title = errors[type];
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
    if (type === 40300) {
        responseJson.detail = "Forbidden";
    }
    res.contentType("application/problem+json");
    res.status(code).send(JSON.stringify(responseJson));
}

module.exports = {
    errorResponse,
    getUrlParam,
    log,
    mergeResponse
};