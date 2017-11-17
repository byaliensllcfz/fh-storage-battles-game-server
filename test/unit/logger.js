'use strict';

const chai   = require('chai');
const fs     = require('fs');
const rewire = require('rewire');
const should = chai.should();

const config = require('../../config');
const logger   = rewire('../../lib/logger');

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
    let log = 'Test Info';
    logger.__get__('infoTransport').on('logged', function(info) {
        fs.readFile(
            '/var/log/app_engine/custom_logs/app-' + config.NAME + '-info.json',
            'utf8',
            function(err, data) {
                should.not.exist(err);
                let content = JSON.parse(data.trim());
                content.level.should.be.equal('info');
                content.message.should.be.equal(log);
                done();
            }
            );
    });
    logger.info(log);
});

it('should log a notice', function(done) {
    let log = 'Test Notice';
    logger.__get__('noticeTransport').on('logged', function(info){
        fs.readFile(
            '/var/log/app_engine/custom_logs/app-' + config.NAME + '-notice.json',
            'utf8',
            function(err, data) {
                should.not.exist(err);
                let content = JSON.parse(data.trim());
                content.level.should.be.equal('notice');
                content.message.should.be.equal(log);
                done();
            }
            );
    });
    logger.notice(log);
});
it('should log an error', function(done) {
    let log = 'Test Error';
    logger.__get__('errorTransport').on('logged', function(info){
        fs.readFile(
            '/var/log/app_engine/custom_logs/app-' + config.NAME + '-error.json',
            'utf8',
            function(err, data) {
                should.not.exist(err);
                let content = JSON.parse(data.trim());
                content.level.should.be.equal('error');
                content.message.should.be.equal(log);
                done();
            }
            );
    });
    logger.error(log);
});
it('should log an alert', function(done) {
    let log = 'Test Alert';
    logger.__get__('alertTransport').on('logged', function(info){
        fs.readFile(
            '/var/log/app_engine/custom_logs/app-' + config.NAME + '-alert.json',
            'utf8',
            function(err, data) {
                should.not.exist(err);
                let content = JSON.parse(data.trim());
                content.level.should.be.equal('alert');
                content.message.should.be.equal(log);
                done();
            }
            );
    });
    logger.alert(log);
});