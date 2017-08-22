"use strict";

// The New Relic require has to be the first thing to run!
var newrelic = require("newrelic");
const bodyParser = require("body-parser");
const express = require("express");

const config = require("./config");
const util = require("./lib/util");

const app = express();
app.set("trust proxy", true);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// API Endpoints
// app.use("/endpoint/route/:var", require("./routes/file-that-contains-the-endpoint"));

// Health Check
app.use("/_ah", require("./routes/health-check"));

// Middlewares
const middleware = require("./lib/middleware");
app.use(middleware.security);
app.use(middleware.notFoundHandler);
app.use(middleware.errorHandler);

if (module === require.main) {
    // Start the server
    const server = app.listen(config["PORT"], () => {
        const port = server.address().port;
        util.logNotice("App listening on port " + port);
    });
}

module.exports = app;