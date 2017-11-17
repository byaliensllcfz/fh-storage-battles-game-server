'use strict';

const mkdirp    = require('mkdirp');
const winston   = require('winston');
const config  = require('../config');

mkdirp.sync('/var/log/app_engine/custom_logs');

const noticeTransport = new winston.transports.File({
            name: 'file.notice',
            level: 'notice',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-notice.json',
            handleExceptions: false,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 4,
            colorize: false
        });
const noticeLogger = new winston.Logger({
    transports: [ noticeTransport ],
    exitOnError: false
});
noticeLogger.setLevels(winston.config.syslog.levels);


const infoTransport =         new winston.transports.File({
            name: 'file.info',
            level: 'info',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-info.json',
            handleExceptions: false,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 4,
            colorize: false
        });
const infoLogger = new winston.Logger({
    transports: [ infoTransport ],
    exitOnError: false
});
infoLogger.setLevels(winston.config.syslog.levels);


const errorTransport = new winston.transports.File({
            name: 'file.error',
            level: 'error',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-error.json',
            handleExceptions: false,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 4,
            colorize: false
        });
const errorLogger = new winston.Logger({
    transports: [ errorTransport ],
    exitOnError: false
});
errorLogger.setLevels(winston.config.syslog.levels);

const alertTransport = new winston.transports.File({
            name: 'file.alert',
            level: 'alert',
            filename: '/var/log/app_engine/custom_logs/app-' + config.NAME +  '-alert.json',
            handleExceptions: false,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 4,
            colorize: false
        });
const alertLogger = new winston.Logger({
    transports: [ alertTransport ],
    exitOnError: false
});
alertLogger.setLevels(winston.config.syslog.levels);

module.exports = {
    'alert': alertLogger.alert,
    'error': errorLogger.error,
    'info': infoLogger.info,
    'notice': noticeLogger.notice
};