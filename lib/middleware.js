'use strict';

var newrelic  = require('newrelic');
const uuid    = require('uuid/v4');

var Datastore = require('../models/datastore');
var logger    = require('./logger');
var util      = require('./util');
const headers = require('../config/tapps-headers');

var currentKey, previousKey;
var datastore = new Datastore();

var routes = [];

/**
 * Creates a list of all endpoints and the http verbs used in each one.
 * @param {Object} app Express App object.
 */
function updateValidRoutes(app) {
    var route;
    var tempRoutes = {};
    app._router.stack.forEach(function(middleware) {
        if (middleware.route) { // routes registered directly on the app
            throw new new Error('There should be no routes registered directly on the app. Move: ' + JSON.stringify(middleware.route) + ' to its own router.');
        } else if (middleware.name === 'router') { // router middleware
            var baseUri = middleware.regexp.toString().split('\\/');
            baseUri.splice(0, 1);
            baseUri.splice(-2, 2);
            baseUri = '/' + baseUri.join('/');
            middleware.handle.stack.forEach(function(handler) {
                route = handler.route;
                if (route) {
                    var uri = baseUri + route.path;
                    tempRoutes[uri] = tempRoutes[uri] || {};
                    tempRoutes[uri].regexp = new RegExp(uri.replace(/\/:.*\//, '/.*/'));
                    tempRoutes[uri].methods = tempRoutes[uri].methods || [];
                    tempRoutes[uri].methods.push(Object.keys(route.methods)[0].toUpperCase());
                }
            });
        }
    });
    Object.keys(tempRoutes).forEach(key => {
        routes.push(tempRoutes[key]);
    });
}

/**
 * Client Authentication.
 * Function called when the endpoint requires authentication to be used.
 * Verifies if the X-Tapps-Game-User-Id-Data or X-Tapps-Service-Account-Name are present and valid.
 * @param {String}   [userId] User ID received by the endpoint.
 * @param {Object}   req      Express request.
 * @param {Object}   res      Express response.
 * @param {Function} next     Calls the next middleware / endpoint function.
 */
function authenticate(userId, req, res, next) {
    var serviceAccountName = req.header(headers['service-account-name']);
    if (serviceAccountName) {
        next();
    } else {
        if (req.header(headers['game-user-id-data'])) {
            var gameUserIdData;
            try {
                gameUserIdData = JSON.parse(req.header(headers['game-user-id-data']));
            } catch(ex){
                gameUserIdData = null;
            }
            if (gameUserIdData && (gameUserIdData.uid === userId || !userId)) {
                next();
            } else {
                util.errorResponse(req, res, 40300, 'Header ' + headers['game-user-id-data'] + ' is missing or invalid.');
            }
        } else {
            util.errorResponse(req, res, 40300, 'Authentication headers are missing.');
        }
    }
}

/**
 * Error handler.
 * This function is called when an exception happens.
 * @param {Object}   err  Application error.
 * @param {Object}   req  Express request.
 * @param {Object}   res  Express response.
 * @param {Function} next Calls the next middleware / endpoint function.
 */
function errorHandler(err, req, res, next) {
    if (err.status === 400) {
        // When the body-parser middleware tries to parse a request and the body is not a json it generates an error.
        util.errorResponse(req, res, 40000, 'Malformed request body.');
    } else {
        var logMessage = util.mergeResponse(req, err);
        logger.error(logMessage);
        util.errorResponse(req, res, 50000, '');
    }
}

/**
 * Basic 404 and 405 handler.
 * This function is only called if the request URI and method didn't match any endpoint.
 * @param {Object} req Express request.
 * @param {Object} res Express response.
 */
function notFoundHandler(req, res) {
    var allowedMethods;
    for (var pos = 0; pos < routes.length; pos++) {
        if (req.originalUrl.match(routes[pos].regexp)) {
            allowedMethods = routes[pos].methods.join(', ');
            break;
        }
    }
    if (allowedMethods) {
        res.set('Allow', allowedMethods);
        util.errorResponse(req, res, 40500, 'This endpoint only supports ' + allowedMethods + '.');
    } else {
        util.errorResponse(req, res, 40400, 'Page not found.');
    }
}

/**
 * Security middleware.
 * Checks if the X-Tapps-Shared-Cloud-Secret header is present and if it's valid.
 * @param {Object}   req  Express request.
 * @param {Object}   res  Express response.
 * @param {Function} next Calls the next middleware / endpoint function.
 */
function security(req, res, next) {
    if (req.path === '/_ah/health') {
        // Health checks don't have the X-Tapps-Shared-Cloud-Secret so we can't apply the filter to all cases.
        next();
    } else {
        // Save the transaction ID header to the response object now so we don't have to do it later.
        var transactionId = req.header(headers['transaction-id']) || ('message-' + uuid());
        res.set(headers['transaction-id'], transactionId);
        req.transaction_id = transactionId;
        var cloudSharedSecret = req.header(headers['shared-cloud-secret']);
        if (cloudSharedSecret) {
            if (cloudSharedSecret === currentKey || cloudSharedSecret === previousKey) {
                // The API accepts both the current Cloud Shared Secret generated by the gateway and the previous one,
                // in order to avoid problems with requests being rejected right after it changes.
                next();
            } else {
                // If the received key is different from the ones we have check if a new one was generated.
                datastore.read({
                    id: 'latest',
                    kind: 'SharedCloudSecret',
                    namespace: 'cloud-configs',
                    callback: function(err, data) {
                        if (err) {
                            // Couldn't find the key in datastore
                            util.errorResponse(req, res, 50001, 'Failed to update server info.');
                        } else {
                            var receivedKey = data.key;
                            if (receivedKey !== currentKey) {
                                // A new key was generated, check if it matches the one received.
                                previousKey = currentKey;
                                currentKey = receivedKey;
                                if (cloudSharedSecret === currentKey) {
                                    next();
                                } else {
                                    util.errorResponse(req, res, 40300, 'Invalid cloud secret header.');
                                }
                            } else {
                                // No new keys were generated, so the received one is invalid.
                                util.errorResponse(req, res, 40300, 'Invalid cloud secret header.');
                            }
                        }
                    }
                });
            }
        } else {
            util.errorResponse(req, res, 40300, 'Missing cloud secret header.');
        }
    }
}

module.exports = {
    authenticate,
    errorHandler,
    notFoundHandler,
    updateValidRoutes,
    security
};