'use strict';

const chai   = require('chai');
const fs     = require('fs');
const rewire = require('rewire');
const sinon  = require('sinon');
const expect = chai.expect;
const should = chai.should();

const config = require('../../config');
var util     = rewire('../../lib/util.js');

describe('Error responses', function() {
    var sandbox;
    var loggerStub, revertLogger;
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
    it('should get the error URL', function(done) {
        var getErrorUrl = util.__get__('getErrorUrl');
        var type = 40400;
        getErrorUrl('', type).should.be.equal('/' + config.NAME +  '/v1/errors/' + type);
        done();
    });
    it('should create a log object, merging the request and response objects', function(done) {
        var req = {
            'client': 'This should be ignored',
            'number': 5,
            'string': 'test',
            'headers': {
                'x-tapps-shared-cloud-secret': 'Header should be removed',
                'x-tapps-header': 'Should still exist'
            }
        };
        var logReq = {
            'number': 5,
            'string': 'test',
            'headers': {
                'x-tapps-header': 'Should still exist'
            }
        };
        var res = {
            'type': '/' + config.NAME + '/v1/errors/40300',
            'status': 403,
            'title': 'Forbidden',
            'detail': 'Forbidden'
        };
        var logMessage = util.mergeResponse(req, res);
        logMessage.request.should.be.deep.equal(logReq);
        logMessage.response.should.be.deep.equal(res);
        done();
    });
    it('should generate a "Forbidden" error response', function(done) {
        var newrelicStub = {
            addCustomParameter: sandbox.stub()
        };
        var revertNewRelic = util.__set__('newrelic', newrelicStub);
        var contentTypeStub = sandbox.stub();
        var statusStub = sandbox.stub();
        var sendStub = sandbox.stub();
        var req = {
            test: 'test'
        };
        var res = {
            contentType: contentTypeStub,
            status: statusStub,
            send: sendStub
        };
        statusStub.returns(res);
        var status = 403;
        var type = 40300;
        util.errorResponse(req, res, type, 'This should only be logged, but shouldn\'t exist in the response.');
        sinon.assert.calledOnce(loggerStub.info);
        sinon.assert.called(newrelicStub.addCustomParameter);
        sinon.assert.calledWith(contentTypeStub, 'application/problem+json');
        sinon.assert.calledWith(statusStub, status);
        sinon.assert.calledOnce(sendStub);
        var response = JSON.parse(sendStub.getCall(0).args[0]);
        response.detail.should.be.equal('Forbidden');
        response.title.should.be.equal('Forbidden');
        response.status.should.be.equal(status);
        revertNewRelic();
        done();
    });
    it('should generate an "Internal Error" response', function(done) {
        var newrelicStub = {
            addCustomParameter: sandbox.stub()
        };
        var revertNewRelic = util.__set__('newrelic', newrelicStub);
        var contentTypeStub = sandbox.stub();
        var statusStub = sandbox.stub();
        var sendStub = sandbox.stub();
        var req = {
            test: 'test'
        };
        var res = {
            contentType: contentTypeStub,
            status: statusStub,
            send: sendStub
        };
        statusStub.returns(res);
        var status = 500;
        var type = 50000;
        var detail = 'This should exist in the response.';
        util.errorResponse(req, res, type, detail);
        sinon.assert.calledOnce(loggerStub.error);
        sinon.assert.called(newrelicStub.addCustomParameter);
        sinon.assert.calledWith(contentTypeStub, 'application/problem+json');
        sinon.assert.calledWith(statusStub, status);
        sinon.assert.calledOnce(sendStub);
        var response = JSON.parse(sendStub.getCall(0).args[0]);
        response.detail.should.be.equal(detail);
        response.title.should.be.equal('Internal Error');
        response.status.should.be.equal(status);
        revertNewRelic();
        done();
    });
});