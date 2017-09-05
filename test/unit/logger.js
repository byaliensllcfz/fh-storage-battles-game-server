'use strict';

const chai   = require('chai');
const fs     = require('fs');
const rewire = require('rewire');
const sinon  = require('sinon');
const expect = chai.expect;
const should = chai.should();

const config = require('../../config');
var logger   = rewire('../../lib/logger');

var log, content;
beforeEach(function() {
    fs.writeFileSync(
        '/var/log/app_engine/custom_logs/app-' + config.NAME + '-notice.json',
        ''
    );
    fs.writeFileSync(
        '/var/log/app_engine/custom_logs/app-' + config.NAME + '-info.json',
        ''
    );
    fs.writeFileSync(
        '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-error.json',
        ''
    );
    fs.writeFileSync(
        '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-alert.json',
        ''
    );
});

it('should log information', function(done) {
    log = 'Test Info';
    logger.info(log);
    fs.readFile(
        '/var/log/app_engine/custom_logs/app-' + config.NAME + '-info.json',
        'utf8',
        function(err, data) {
            should.not.exist(err);
            content = JSON.parse(data.trim());
            content.level.should.be.equal('info');
            content.message.should.be.equal(log);
            done();
        }
    );
});
it('should log a notice', function(done) {
    log = 'Test Notice';
    logger.notice(log);
    fs.readFile(
        '/var/log/app_engine/custom_logs/app-' + config.NAME + '-notice.json',
        'utf8',
        function(err, data) {
            should.not.exist(err);
            content = JSON.parse(data.trim());
            content.level.should.be.equal('notice');
            content.message.should.be.equal(log);
            done();
        }
    );
});
it('should log an error', function(done) {
    log = 'Test Error';
    logger.error(log);
    fs.readFile(
        '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-error.json',
        'utf8',
        function(err, data) {
            should.not.exist(err);
            content = JSON.parse(data.trim());
            content.level.should.be.equal('error');
            content.message.should.be.equal(log);
            done();
        }
    );
});
it('should log an alert', function(done) {
    log = 'Test Alert';
    logger.alert(log);
    fs.readFile(
        '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-alert.json',
        'utf8',
        function(err, data) {
            should.not.exist(err);
            content = JSON.parse(data.trim());
            content.level.should.be.equal('alert');
            content.message.should.be.equal(log);
            done();
        }
    );
});