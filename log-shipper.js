'use strict';

const childProcess = require('child_process');
const Logger = require('tp-common/logger');

const config = require('./config');
const logger = new Logger(config);

function start () {
    const child = childProcess.spawn('logagent', ['-c', 'logagent.conf']);
    child.on('exit', (code, signal) => {
        logger.alert('logagent process exited with code ' + code + ' and signal ' + signal);
        start();
    });
}

module.exports = {
    start,
};
