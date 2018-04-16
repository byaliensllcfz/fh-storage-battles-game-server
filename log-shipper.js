'use strict';

const childProcess = require('child_process');
const Logger = require('tp-common/logger');

const config = require('./config');
const logger = new Logger(config);

let running = false;

function start() {
    function restart() {
        if (running) {
            running = false;
            start();
        }
    }
    const child = childProcess.spawn('./node_modules/.bin/logagent', ['-c', 'logagent.conf']);
    running = true;

    child.stdout.on('data', data => {
        console.log(`Logagent: ${data}`); // eslint-disable-line no-console
    });
    child.stderr.on('data', data => {
        console.error(`Logagent: ${data}`); // eslint-disable-line no-console
    });
    child.on('close', (code, signal) => {
        logger.alert(`Logagent process closed with code: ${code} and signal: ${signal}`);
        restart();
    });
    child.on('disconnect', () => {
        logger.alert('Logagent process disconnected.');
        restart();
    });
    child.on('error', error => {
        logger.alert(error);
        restart();
    });
    child.on('exit', (code, signal) => {
        logger.alert(`Logagent process exited with code: ${code} and signal: ${signal}`);
        restart();
    });
}

module.exports = {
    start,
};
