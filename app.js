'use strict';

var newrelic = require('newrelic');

const config = require('./config');
const datastore = require('./datastore');
const express = require('express');
const util = require("./util");

const app = express();
app.set('trust proxy', true);

var currentKey, previousKey;

// Security middleware
app.use(function(req, res, next) {
    if (req.path === '/_ah/health') {
        // Health checks don't have the X-Tapps-Shared-Cloud-Secret so we can't apply the filter to all cases.
        return next();
    } else {
        // Save the transaction ID header to the response object now so we don't have to do it later.
        var transactionId = req.header("X-Tapps-Transaction-Id");
        if (transactionId) {
            res.set("X-Tapps-Transaction-Id", transactionId);
        }
        var cloudSharedSecret = req.header("X-Tapps-Shared-Cloud-Secret");
        if (cloudSharedSecret) {
            if (cloudSharedSecret === currentKey || cloudSharedSecret === previousKey) {
                // The API accepts both the current Cloud Shared Secret generated by the gateway and the previous one,
                // in order to avoid problems with requests being rejected right after it changes.
                return next();
            } else {
                // If the received key is different from the ones we have check if a new one was generated.
                datastore.read({
                    "id": "latest",
                    "kind": "SharedCloudSecret",
                    "namespace": "cloud-configs",
                    "callback": function(params) {
                        if (params.error) {
                            // Couldn't find the key in datastore
                            util.errorResponse(req, res, 500, 50000, "Internal Error", "Failed to update server info.");
                        } else {
                            var receivedKey = params.data.key;
                            if (receivedKey !== currentKey) {
                                // A new key was generated, check if it matches the one received.
                                previousKey = currentKey;
                                currentKey = receivedKey;
                                if (cloudSharedSecret === currentKey) {
                                    next();
                                } else {
                                    util.errorResponse(req, res, 403, 40300, "Forbidden", "Invalid cloud secret header.");
                                }
                            } else {
                                // No new keys were generated, so the received one is invalid.
                                util.errorResponse(req, res, 403, 40300, "Forbidden", "Invalid cloud secret header.");
                            }
                        }
                    }
                });
            }
        } else {
            util.errorResponse(req, res, 403, 40300, "Forbidden", "Missing cloud secret header.");
        }
    }
});

// API Endpoints
// app.use("/endpoint/route/:var", require("./file-that-contains-the-endpoint"));

// Health Check
app.use("/_ah", require("./HealthCheck"));

/*
    Error codes:
        40000: Bad Request
        40001: Account cannot be linked with Facebook ID
        40002: User already has an account for this game
        40300: Cloud Shared Secret missing or invalid
        40301: Access token could not be authenticated with Facebook
        40302: ID Token couldn't be verified by Firebase
        40303: Token ID missmatch
        40400: Not Found
        42200: Missing parameter in JSON
        50000: Internal Error
        50001: Failed to encrypt the Facebook ID
        50002: Facebook sign-in failed
        50003: Failed to create custom token
        50004: Missing Firebase Admin SDK json
 */

// Basic 404 handler
app.use((req, res) => {
    util.errorResponse(req, res, 404, 40400, "Not Found", "Page not found.");
});

// Error handler
app.use((err, req, res, next) => {
    var logMessage = util.mergeResponse(req, err);
    var entry = util.log.entry(logMessage);
    if (err.status === 400) {
        // When the body-parser middleware tries to parse a request and the body is not a json it generates an error.
        util.errorResponse(req, res, err.status, 40000, "Bad Request.", "Malformed request body.");
    } else {
        util.log.error(entry, function(err, apiResponse) {});
        newrelic.addCustomParameter(logMessage);
        util.errorResponse(req, res, 500, 50000, "Internal error.", "");
    }
});

if (module === require.main) {
    // Start the server
    const server = app.listen(config['PORT'], () => {
        const port = server.address().port;
        var entry = util.log.entry("App listening on port " + port);
        util.log.notice(entry, function(err, apiResponse) {});
    });
}

module.exports = app;