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
var winstonLogger = new winston.Logger({
    transports: [
        new winston.transports.File({
            name: 'file.notice',
            level: 'notice',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-notice.json',
            handleExceptions: false,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 4,
            colorize: false
        }),
        new winston.transports.File({
            name: 'file.info',
            level: 'info',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-info.json',
            handleExceptions: false,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 4,
            colorize: false
        }),
        new winston.transports.File({
            name: 'file.error',
            level: 'error',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-error.json',
            handleExceptions: false,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 4,
            colorize: false
        }),
        new winston.transports.File({
            name: 'file.alert',
            level: 'alert',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-alert.json',
            handleExceptions: false,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 4,
            colorize: false
        })
    ],
    exitOnError: false
});
winstonLogger.setLevels(winston.config.syslog.levels);

function notice(params) {
    var entry = log.entry(params);
    log.notice(entry);
    winstonLogger.notice(params);
}

function info(params) {
    var entry = log.entry(params);
    log.info(entry);
    winstonLogger.info(params);
}

function error(params) {
    var entry = log.entry(params);
    log.error(entry);
    winstonLogger.error(params);
}

function alert(params) {
    var entry = log.entry(params);
    log.alert(entry);
    winstonLogger.alert(params);
}

module.exports = {
    alert,
    error,
    info,
    notice
};