const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const homeDir = require('./env').homeDir;

function list() {
    // TODO: List installed versions
}

function install(version) {
    // TODO: Download and install the specified version
}

function uninstall(version) {
    // TODO: Uninstall the specified version
}

module.exports = {
    list,
    install,
    uninstall,
}
