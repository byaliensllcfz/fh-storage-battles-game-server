'use strict';

const chai      = require('chai');
const httpMocks = require('node-mocks-http');
const rewire    = require('rewire');
const sinon     = require('sinon');
const expect    = chai.expect;
const should    = chai.should();

const config     = require('../../config');
const middleware = rewire('../../lib/middleware');

var sandbox;
var loggerStub, revertLogger;
var utilStub, revertUtil;
beforeEach(function () {
    sandbox = sinon.sandbox.create();
    utilStub = {
        errorResponse: sandbox.stub(),
        mergeResponse: sandbox.stub()
    };
    loggerStub = {
        error: sandbox.stub(),
    };
    revertUtil = middleware.__set__('util', utilStub);
    revertLogger = middleware.__set__('logger', loggerStub);
});
afterEach(function () {
    revertUtil();
    revertLogger();
    sandbox.restore();
});

describe('Client Authentication', function() {
    it('should allow the request because the Service Account Name header is present', function(done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-service-account-name': 'name'
            }
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.authenticate('', req, res, nextStub);
        sinon.assert.calledOnce(nextStub);
        done();
    });
    it('should allow the request because the Game User Id Data header is present', function(done) {
        var uid = 'uid';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-game-user-id-data': '{"uid": "' + uid + '"}'
            }
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.authenticate('', req, res, nextStub);
        sinon.assert.calledOnce(nextStub);
        done();
    });
    it('should allow the request because the Game User Id Data header is present and the uid is the same as the one in the URL', function(done) {
        var uid = 'uid';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-game-user-id-data': '{"uid": "' + uid + '"}'
            }
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.authenticate(uid, req, res, nextStub);
        sinon.assert.calledOnce(nextStub);
        done();
    });
    it('should fail because the uid received in the Game User Id Data header is different from the one in the URL', function(done) {
        var uid = 'uid';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-game-user-id-data': '{"uid": "' + uid + '"}'
            }
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.authenticate('wrong-uid', req, res, nextStub);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 40300);
        done();
    });
    it('should fail because the Game User Id Data header is invalid', function(done) {
        var uid = 'uid';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-game-user-id-data': '{invalidJson'
            }
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.authenticate('', req, res, nextStub);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 40300);
        done();
    });
});

describe('Error Handler', function() {
    it('should send a response with status code 400', function(done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint'
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        var err = {
            status: 400,
            message: 'Test error 400.'
        };
        middleware.errorHandler(err, req, res, nextStub);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 40000);
        done();
    });
    it('should send a response with status code 500', function(done) {
        var newrelicStub = {
            addCustomParameter: sandbox.stub()
        };
        var revertNewRelic = middleware.__set__('newrelic', newrelicStub);
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint'
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        var err = {
            message: 'Test error 500.'
        };
        middleware.errorHandler(err, req, res, nextStub);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 50000);
        revertNewRelic();
        done();
    });
});

describe('Not Found Handler', function() {
    it('should send a response with status code 405', function(done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint'
        });
        var res = httpMocks.createResponse();
        res.locals = {};
        res.locals.methods = ['POST'];
        middleware.notFoundHandler(req, res);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 40500);
        done();
    });
    it('should send a response with status code 404', function(done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint'
        });
        var res = httpMocks.createResponse();
        res.locals = {};
        middleware.notFoundHandler(req, res);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 40400);
        done();
    });
});

describe('Security', function() {
    it('should bypass the security verifications in order to reach the Health Check endpoint', function(done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/_ah/health'
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.security(req, res, nextStub);
        sinon.assert.calledOnce(nextStub);
        done();
    });
    it('should fail because the Shared Cloud Secret header is missing', function(done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint'
        });
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.security(req, res, nextStub);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 40300);
        done();
    });
    it('should succeed because the Shared Cloud Secret header is equal to the current key', function(done) {
        var sharedCloudSecret = '0-0';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-shared-cloud-secret': sharedCloudSecret
            }
        });
        var revertCurrentKey = middleware.__set__('currentKey', sharedCloudSecret);
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.security(req, res, nextStub);
        sinon.assert.calledOnce(nextStub);
        revertCurrentKey();
        done();
    });
    it('should succeed because the Shared Cloud Secret header is equal to the previous key', function(done) {
        var sharedCloudSecret = '0-0';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-shared-cloud-secret': sharedCloudSecret
            }
        });
        var revertPreviousKey = middleware.__set__('previousKey', sharedCloudSecret);
        var res = httpMocks.createResponse();
        var nextStub = sandbox.stub();
        middleware.security(req, res, nextStub);
        sinon.assert.calledOnce(nextStub);
        revertPreviousKey();
        done();
    });
    it('should fail to retrieve the current Shared Cloud Secret from datastore', function(done) {
        var sharedCloudSecret = '0-0';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-shared-cloud-secret': sharedCloudSecret
            }
        });
        var res = httpMocks.createResponse();
        var datastoreStub = {
            read: function(params) {
                params.callback(true);
            }
        };
        var revertDatastore = middleware.__set__('datastore', datastoreStub);
        var nextStub = sandbox.stub();
        middleware.security(req, res, nextStub);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 50001);
        revertDatastore();
        done();
    });
    it('should succeed because the retrieved key is equal to the one in the request header', function(done) {
        var sharedCloudSecret = '0-0';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-shared-cloud-secret': sharedCloudSecret
            }
        });
        var res = httpMocks.createResponse();
        var datastoreStub = {
            read: function(params) {
                params.callback(
                    false,
                    {
                        key: sharedCloudSecret
                    }
                );
            }
        };
        var revertDatastore = middleware.__set__('datastore', datastoreStub);
        var revertCurrentKey = middleware.__set__('currentKey', '');
        var revertPreviousKey = middleware.__set__('previousKey', '');
        var nextStub = sandbox.stub();
        middleware.security(req, res, nextStub);
        sinon.assert.calledOnce(nextStub);
        revertDatastore();
        revertCurrentKey();
        revertPreviousKey();
        done();
    });
    it('should fail because the Shared Cloud Secret received is not equal to the cached keys nor the one in datastore', function(done) {
        var sharedCloudSecret = '0-0';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-shared-cloud-secret': sharedCloudSecret
            }
        });
        var res = httpMocks.createResponse();
        var datastoreStub = {
            read: function(params) {
                params.callback(
                    false,
                    {
                        key: 'wrong-key'
                    }
                );
            }
        };
        var revertDatastore = middleware.__set__('datastore', datastoreStub);
        var revertCurrentKey = middleware.__set__('currentKey', '');
        var revertPreviousKey = middleware.__set__('previousKey', '');
        var nextStub = sandbox.stub();
        middleware.security(req, res, nextStub);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 40300);
        revertDatastore();
        revertCurrentKey();
        revertPreviousKey();
        done();
    });
    it('should fail because the Shared Cloud Secret received is different from the cached ones, and no new key was generated', function(done) {
        var sharedCloudSecret = '0-0';
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test/endpoint',
            headers: {
                'x-tapps-shared-cloud-secret': sharedCloudSecret
            }
        });
        var res = httpMocks.createResponse();
        var datastoreStub = {
            read: function(params) {
                params.callback(
                    false,
                    {
                        key: 'wrong-key'
                    }
                );
            }
        };
        var revertDatastore = middleware.__set__('datastore', datastoreStub);
        var revertCurrentKey = middleware.__set__('currentKey', 'wrong-key');
        var revertPreviousKey = middleware.__set__('previousKey', '');
        var nextStub = sandbox.stub();
        middleware.security(req, res, nextStub);
        sinon.assert.calledOnce(utilStub.errorResponse);
        sinon.assert.calledWith(utilStub.errorResponse, req, res, 40300);
        revertDatastore();
        revertCurrentKey();
        revertPreviousKey();
        done();
    });
});