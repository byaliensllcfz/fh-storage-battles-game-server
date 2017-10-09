'use strict';

var logging   = require('@google-cloud/logging');
var mkdirp    = require('mkdirp');
var winston   = require('winston');

const config  = require('../config');

const loggingClient = logging({
    projectId: process.env.DATASTORE_PROJECT_ID || config.GCLOUD_PROJECT
});
const log = loggingClient.log(config.NAME + '-logs');

mkdirp.sync('/var/log/app_engine/custom_logs');
var noticeLogger = new winston.Logger({
    transports: [
        new winston.transports.File({
            name: 'file.notice',
            level: 'notice',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-notice.json',
            handleExceptions: false,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 4,
            colorize: false
        })
    ],
    exitOnError: false
});
noticeLogger.setLevels(winston.config.syslog.levels);

var infoLogger = new winston.Logger({
    transports: [
        new winston.transports.File({
            name: 'file.info',
            level: 'info',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-info.json',
            handleExceptions: false,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 4,
            colorize: false
        })
    ],
    exitOnError: false
});
infoLogger.setLevels(winston.config.syslog.levels);

var errorLogger = new winston.Logger({
    transports: [
        new winston.transports.File({
            name: 'file.error',
            level: 'error',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-error.json',
            handleExceptions: false,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 4,
            colorize: false
        })
    ],
    exitOnError: false
});
errorLogger.setLevels(winston.config.syslog.levels);

var alertLogger = new winston.Logger({
    transports: [
        new winston.transports.File({
            name: 'file.alert',
            level: 'alert',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-alert.json',
            handleExceptions: false,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 4,
            colorize: false
        })
    ],
    exitOnError: false
});
alertLogger.setLevels(winston.config.syslog.levels);

function notice(params) {
    var entry = log.entry(params);
    log.notice(entry);
    noticeLogger.notice(params);
}

function info(params) {
    var entry = log.entry(params);
    log.info(entry);
    infoLogger.info(params);
}

function error(params) {
    var entry = log.entry(params);
    log.error(entry);
    errorLogger.error(params);
}

function alert(params) {
    var entry = log.entry(params);
    log.alert(entry);
    alertLogger.alert(params);
}

module.exports = {
    alert,
    error,
    info,
    notice
};