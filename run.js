#!/usr/local/bin/node

require("./cgi.js");

var server = new CgiServer("./config.json");

server.start();