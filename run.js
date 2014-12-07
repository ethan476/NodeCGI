#!/usr/local/bin/node

require("./cgi.js");

var server = new CGIServer("./config.json");
server.start();