'use strict';

const httpMocks = require('node-mocks-http');
const rewire    = require('rewire');
const sinon     = require('sinon');

const config = require('../../config');
let util     = rewire('../../lib/util');

describe('Auxiliar functions', function() {
    it('should get the error URL', function(done) {
        let getErrorUrl = util.__get__('getErrorUrl');
        let type = 40400;
        getErrorUrl('', type).should.be.equal('/' + config.NAME + '/' + config.VERSION + '/errors/' + type);
        done();
    });
    it('should convert an error object to a regular object', function(done) {
        let replaceErrors = util.__get__('replaceErrors');
        let error = new Error();
        error = replaceErrors(error);
        error.should.be.a('object');
        error.should.have.property('stack');
        done();
    });
    it('should create a log object, merging the request and response objects', function(done) {
        let req = {
            'client': 'This should be ignored',
            'headers': {
                'x-tapps-shared-cloud-secret': 'Header should be removed',
                'x-tapps-header': 'Should still exist'
            }
        };
        let logReq = {
            'headers': {
                'x-tapps-header': 'Should still exist'
            }
        };
        let res = {
            'type': '/' + config.NAME + '/' + config.VERSION + '/errors/40300',
            'status': 403,
            'title': 'Forbidden',
            'detail': 'Forbidden'
        };
        let logMessage = util.mergeResponse(req, res);
        logMessage.request.should.be.deep.equal(logReq);
        logMessage.response.should.be.deep.equal(res);
        done();
    });
    it('should create a log object of a request that has no headers', function(done) {
        let req = {
            'client': 'This should be ignored',
            'originalUrl': 'But this should not'
        };
        let logReq = {
            'originalUrl': 'But this should not'
        };
        let res = {
            'type': '/' + config.NAME + '/' + config.VERSION + '/errors/40300',
            'status': 403,
            'title': 'Forbidden',
            'detail': 'Forbidden'
        };
        let logMessage = util.mergeResponse(req, res);
        logMessage.request.should.be.deep.equal(logReq);
        logMessage.response.should.be.deep.equal(res);
        done();
    });
});

describe('Error responses', function() {
    let sandbox;
    let loggerStub, revertLogger;
    beforeEach(function () {
        sandbox = sinon.sandbox.create();
        loggerStub = {
            error: sandbox.stub(),
            info: sandbox.stub()
        };
        revertLogger = util.__set__('logger', loggerStub);
    });
    afterEach(function () {
        revertLogger();
        sandbox.restore();
    });
    it('should generate a "Not Found" error response', function(done) {
        let contentTypeStub = sandbox.stub();
        let statusStub = sandbox.stub();
        let sendStub = sandbox.stub();
        let req = {
            test: 'test'
        };
        let res = {
            contentType: contentTypeStub,
            locals: {},
            send: sendStub,
            status: statusStub,
        };
        statusStub.returns(res);
        let status = 404;
        let type = 40400;
        let detail = 'Endpoint not found.';
        util.errorResponse(req, res, type, detail);
        sinon.assert.calledWith(contentTypeStub, 'application/problem+json');
        sinon.assert.calledWith(statusStub, status);
        sinon.assert.calledOnce(sendStub);
        let response = JSON.parse(sendStub.getCall(0).args[0]);
        response.detail.should.be.equal(detail);
        response.title.should.be.equal('Not Found');
        response.status.should.be.equal(status);
        done();
    });
    it('should generate a "Forbidden" error response', function(done) {
        let newrelicStub = {
            addCustomParameters: sandbox.stub()
        };
        let revertNewRelic = util.__set__('newrelic', newrelicStub);
        let contentTypeStub = sandbox.stub();
        let statusStub = sandbox.stub();
        let sendStub = sandbox.stub();
        let req = {
            test: 'test'
        };
        let res = {
            contentType: contentTypeStub,
            locals: {},
            send: sendStub,
            status: statusStub,
        };
        statusStub.returns(res);
        let status = 403;
        let type = 40300;
        util.errorResponse(req, res, type, 'This should only be logged, but shouldn\'t exist in the response.');
        sinon.assert.calledWith(contentTypeStub, 'application/problem+json');
        sinon.assert.calledWith(statusStub, status);
        sinon.assert.calledOnce(sendStub);
        let response = JSON.parse(sendStub.getCall(0).args[0]);
        response.detail.should.be.equal('Forbidden');
        response.title.should.be.equal('Forbidden');
        response.status.should.be.equal(status);
        revertNewRelic();
        done();
    });
    it('should generate an "Internal Error" response', function(done) {
        let newrelicStub = {
            addCustomParameters: sandbox.stub()
        };
        let revertNewRelic = util.__set__('newrelic', newrelicStub);
        let contentTypeStub = sandbox.stub();
        let statusStub = sandbox.stub();
        let sendStub = sandbox.stub();
        let req = {
            test: 'test'
        };
        let res = {
            contentType: contentTypeStub,
            locals: {},
            send: sendStub,
            status: statusStub,
        };
        statusStub.returns(res);
        let status = 500;
        let type = 50000;
        let detail = 'This should exist in the response.';
        util.errorResponse(req, res, type, detail);
        sinon.assert.calledWith(contentTypeStub, 'application/problem+json');
        sinon.assert.calledWith(statusStub, status);
        sinon.assert.calledOnce(sendStub);
        let response = JSON.parse(sendStub.getCall(0).args[0]);
        response.detail.should.be.equal(detail);
        response.title.should.be.equal('Internal Error');
        response.status.should.be.equal(status);
        revertNewRelic();
        done();
    });
    it('should fail because there is no title defined for that error type', function(done) {
        let revertConfig = util.__set__('config', {'ENV': 'dev'});
        let req = {
            test: 'test'
        };
        let res = {};
        let type = 40499;
        let detail = 'Endpoint not found.';
        let errorFunction = function() {
            util.errorResponse(req, res, type, detail);
        };
        errorFunction.should.throw();
        revertConfig();
        done();
    });
});

describe('Success Responses', function() {
    it('should send a response and store the sent values on res.locals', function(done) {
        let res = httpMocks.createResponse();
        res.locals = {};
        let status = 200;
        let data = {
            'test': 'data'
        };
        let responseJson = {
            'status': status,
            'data': data
        };
        util.successResponse(res, status, data);
        res.statusCode.should.be.equal(200);
        res.locals.responseJson.should.be.deep.equal(responseJson);
        done();
    });
});

describe('Log Transaction', function() {
    let sandbox;
    let loggerStub, revertLogger;
    beforeEach(function () {
        sandbox = sinon.sandbox.create();
        loggerStub = {
            error: sandbox.stub(),
            info: sandbox.stub()
        };
        revertLogger = util.__set__('logger', loggerStub);
    });
    afterEach(function () {
        revertLogger();
        sandbox.restore();
    });
    it('should log a successful transaction', function (done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test'
        });
        let res = httpMocks.createResponse();
        let status = 200;
        let data = {
            'test': 'data'
        };
        res.statusCode = status;
        res.locals = {
            'responseJson': {
                'status': status,
                'data': data
            }
        };
        let duration = '50';
        util.logTransaction(req, res, duration);
        sinon.assert.calledOnce(loggerStub.info);
        done();
    });
    it('should log a 4XX error', function (done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test'
        });
        let res = httpMocks.createResponse();
        let status = 404;
        let type = 40400;
        let title = 'Test Title';
        let detail = 'Test detail.';
        res.statusCode = status;
        res.locals = {
            'responseJson': {
                'status': status,
                'type': type,
                'title': title,
                'detail': detail
            }
        };
        let duration = '50';
        util.logTransaction(req, res, duration);
        sinon.assert.calledOnce(loggerStub.info);
        done();
    });
    it('should log a 5XX error', function (done) {
        var req  = httpMocks.createRequest({
            method: 'GET',
            url: '/test'
        });
        let res = httpMocks.createResponse();
        let status = 500;
        let type = 50000;
        let title = 'Test Title';
        let detail = 'Test detail.';
        res.statusCode = status;
        res.locals = {
            'responseJson': {
                'status': status,
                'type': type,
                'title': title,
                'detail': detail
            }
        };
        let duration = '50';
        util.logTransaction(req, res, duration);
        sinon.assert.calledOnce(loggerStub.error);
        done();
    });
});