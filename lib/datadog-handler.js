'use strict';

const config = require('../config');
const childProcess = require('child_process');
const {Logger} = require('tp-common');

let traceAgentPID = -1;
let datadogAgentPID = -1;
let logger = new Logger(config);

function _addTraceListeners(child, config) {
    const expectedPID = child.pid;
    if (child.stdout) {
        child.stdout.on('data', data => {
            // This is necessary in order for Logstash to work, might be needed for DataDog as well
            console.info(`datadog-trace-agent: ${data}`); // eslint-disable-line no-console
        });
    }

    if (child.stderr) {
        child.stderr.on('data', data => {
            console.error(`datadog-trace-agent: ${data}`); // eslint-disable-line no-console
        });
    }

    child.on('close', (code, signal) => {
        logger.alert(`datadog-trace-agent process closed with code: ${code} and signal: ${signal}`);
        if (traceAgentPID === expectedPID) {
            startTraceAgent(config);
        }
    });

    child.on('disconnect', () => {
        logger.alert('datadog-trace-agent process disconnected.');
        if (traceAgentPID === expectedPID) {
            startTraceAgent(config);
        }
    });

    child.on('error', error => {
        logger.alert(error);
        if (traceAgentPID === expectedPID) {
            startTraceAgent(config);
        }
    });

    child.on('exit', (code, signal) => {
        logger.alert(`datadog-trace-agent process exited with code: ${code} and signal: ${signal}`);
        if (traceAgentPID === expectedPID) {
            startTraceAgent(config);
        }
    });
}

function _addDatadogListeners(child, config) {
    const expectedPID = child.pid;

    if (child.stdout) {
        child.stdout.on('data', data => {
            // This is necessary in order for Logstash to work, might be needed for DataDog as well
            console.info(`datadog-agent: ${data}`); // eslint-disable-line no-console
        });
    }

    if (child.stderr) {
        child.stderr.on('data', data => {
            console.error(`datadog-agent: ${data}`); // eslint-disable-line no-console
        });
    }

    child.on('close', (code, signal) => {
        logger.alert(`datadog-agent process closed with code: ${code} and signal: ${signal}`);
        if (datadogAgentPID === expectedPID) {
            startDatadogAgent(config);
        }
    });

    child.on('disconnect', () => {
        logger.alert('datadog-agent process disconnected.');
        if (datadogAgentPID === expectedPID) {
            startDatadogAgent(config);
        }
    });

    child.on('error', error => {
        logger.alert(error);
        if (datadogAgentPID === expectedPID) {
            startDatadogAgent(config);
        }
    });

    child.on('exit', (code, signal) => {
        logger.alert(`datadog-agent process exited with code: ${code} and signal: ${signal}`);
        if (datadogAgentPID === expectedPID) {
            startDatadogAgent(config);
        }
    });
}

/**
 * Start DataDog Agent in a child process, which will send relevant data to DataDog
 * If any error occurs the process is automatically restarted.
 */
function startDatadogAgent(config) {
    const child = childProcess.spawn('datadog-agent', ['run', '-c', '/etc/datadog-agent/datadog.yaml']);
    datadogAgentPID = child.pid;
    _addDatadogListeners(child, config);
}

/**
 * Start DataDog Trace Agent to send APM data.
 */
function startTraceAgent(config) {
    const child = childProcess.spawn('/opt/datadog-agent/embedded/bin/trace-agent', ['-config', '/etc/datadog-agent/datadog.yaml']);
    traceAgentPID = child.pid;
    _addTraceListeners(child, config);
}

module.exports = {
    startDatadogAgent,
    startTraceAgent,
};
