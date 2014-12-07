var fs = require("fs");
var http = require("http");
var path = require("path");
var url = require("url");
var querystring = require('querystring');

function CGIServer(configurationFile, port) {
	var self = this;

	self.config = require(configurationFile);

	self.servers = [];

	self.usedPorts = [];

	self.hostToDomainTable = {};

	/* Load Handlers */
	self.handlers = {};
	for (var ext in self.config["extensions"]) {
		var handlerName = self.config["extensions"][ext]["handler"];

		if (typeof handlerName === "undefined") {

		} else {

			self.findHandler(handlerName, self.config["handlerPaths"], function(err, handlerObject) {
				if (err === true) {
					console.log(err)
				} else {
					self.handlers[ext] = handlerObject;
					console.log("Loaded handler for *" + ext);
				}
			});
		}
	}

	if (self.handlers.length == 0) {
		/* No handlers loaded */
		console.log("Warning: no handlers loaded");
	}
}	

CGIServer.prototype.start = function() {
	var self = this;

	for(i in self.config["virtualHosts"]) {
		console.log("Loading vhost: " + self.config["virtualHosts"][i]["domain"])
		if (self.usedPorts.length == 0) {
			self.listenOn(self.config["virtualHosts"][i], self.config["virtualHosts"][i]["port"]);
		} else {
	    	for(var j = 0; j < self.usedPorts.length; j++) {
	       		if (self.usedPorts[j] === self.config["virtualHosts"][i]["port"]) {
	           		break;
	       		}
	       		if (j + 1 == self.usedPorts.length) {
	       			self.listenOn(self.config["virtualHosts"][i], self.config["virtualHosts"][i]["port"]);
	       		}
	   		}
   		}
   	}
}

CGIServer.prototype.listenOn = function(domain, port) {
	var self = this;
	/* Default Arguments */

    server = http.createServer(function(request, response) {
		var uri = url.parse(request.url).pathname;

		var domain = self.getDomain(request);

		console.log(domain)

		if (domain !== false) {
			var docroot = self.config["virtualHosts"][domain]["documentRoot"];

			var filename = path.join(docroot, uri);

			console.log(filename);

			if (!fs.existsSync(filename)) {
				/* File doesn't exist */
				return self.httpError(404, self, request, response);
			} else if (fs.lstatSync(filename).isDirectory()) {
				/* Load index file or pass to __directory__ handler */
				for(var i in self.config["indexFiles"]) {
					indexFilename = filename + "/" + self.config["indexFiles"][i];
					if (fs.existsSync(indexFilename)) {
						if (fs.lstatSync(indexFilename).isFile()) {
							return self.executeHandler(indexFilename, self, request, response);
						}
					}
				}

				return self.directory(filename, self, request, response);
			} else {
				return self.executeHandler(filename, self, request, response);
			}
		} else {
			/* Whoops, that domain doesn't exist according to the vhosts record, pretend were not home. */
			response.socket.end();
		}
	}).listen(port);

    self.usedPorts.push(port);

    server.on('connection', function (socket) {
        if (typeof this.sockets === "undefined") {
            this.sockets = new Array();
        }
        this.sockets.push(socket);
    });

    self.servers.push(server)
};

CGIServer.prototype.send = function(status, args, data, response) {
	response.writeHead(status, args);
	response.write(data);
	response.end();
};

CGIServer.prototype.serverStatic = function(filename, request, config, callback) {
	fs.readFile(filename, function (err, data) {
		if (err) {
			console.log(err)
		} else {
			var extName = path.extname(filename);
			if (extName in config["staticExtensions"]) {
				callback(false, 200, {
					"Content-Type": config["staticExtensions"][extName],
					"Content-Length": data.length
				}, data);
			} else {
				callback(false, 200, {
					"Content-Type": "application/octet-stream",
					"Content-Length": data.length
				}, data);
			}
		}
	});
};

CGIServer.prototype.findHandler = function(handlerName, paths, callback) {
	for(var i in paths) {
		var path = paths[i] + "/" + handlerName + ".js";

		if (fs.existsSync(path)) {
			callback(false, require(path));
		} else if (i + 1 = paths.length) {
			callback(new Error("Failed to locate handler: " + handlerName), null);
		}
	}
}

CGIServer.prototype.executeHandler = function(filename,  self, request, response) {
	var extName = path.extname(filename);
	
	if (!extName) {
		/* File has no extension, assume static... */
		return self.serverStatic(filename, request, self.config, function(err, status, args, data) {
			if (err) {
				/* Hmm, what now? */
			}
			self.send(status, args, data, response);
		});
	} else if (extName in self.handlers == false) {
		/* No extension handler, serve static */
		return self.serverStatic(filename, request, self.config, function(err, status, args, data) {
			if (err) {
				/* Hmm, what now? */
			}
			self.send(status, args, data, response);
		});
	} else {

		var handler = self.handlers[extName];

		handler.handle(filename, request, self.config, function(err, status, args, data) {
			if (err) {
				/* Hmm, what now? */
			}
			self.send(status, args, data, response);
		});
	}
};

CGIServer.prototype.getDomain = function(request) {
	var self = this;

	var host = request["headers"]["host"].split(":");

	if (request["headers"]["host"] in self.hostToDomainTable) {
		return self.hostToDomainTable[request["headers"]["host"]];
	} else {

		for(var i = 0; i < self.config["virtualHosts"].length; i++) {

			if (self.config["virtualHosts"][i]["domain"] == host[0] && self.config["virtualHosts"][i]["port"] == host[1]) {
				self.hostToDomainTable[request["headers"]["host"]] = i;
				return i;
			} else if (i + 1 == self.config["virtualHosts"].length && self.config["virtualHostPartialMatching"] == true) {
				for(var j = 0; i < self.config["virtualHosts"].length; j++) {
					if (self.config["virtualHosts"][j]["domain"] == host[0]) {
						self.hostToDomainTable[request["headers"]["host"]] = j;
						return j;
					}

					if (j + 1 == self.config["virtualHosts"].length) {
						for(var z = 0; i < self.config["virtualHosts"].length; z++) {
							if (self.config["virtualHosts"][z]["port"] == host[1]) {
								self.hostToDomainTable[request["headers"]["host"]] = z;
								return z;
							}
						}
					}
				}
			} else {
				return false;
			}
		}
	}
}


CGIServer.prototype.httpError = function(error, self, request, response) {
	var fileName = "__" + error + "__";

	if (fileName in self.config["virtualHosts"][self.getDomain(request)]["specialFiles"]) {
		var file = path.join(self.config["virtualHosts"][self.getDomain(request)]["documentRoot"], self.config["virtualHosts"][self.getDomain(request)]["specialFiles"][fileName]);

		if (fs.lstatSync(file).isFile() === false) {
			return self.httpErrorLastResort(error, self, request, response);
		} else {
			return self.executeHandler(file, self, request, response);
		}
	} else {
		return self.httpErrorLastResort(error, self, request, response);
	}
};

CGIServer.prototype.httpErrorLastResort = function(error, self, request, response) {
	self.send(error, {
		"Content-Type": "text/html"
	}, "<h1>Error: " + error + "</h1>", response);
};

CGIServer.prototype.directory = function(filename, self, request, response) {
	if ("__directory__" in self.config["virtualHosts"][self.getDomain(request)]["specialFiles"]) {
		var file = self.config["virtualHosts"][self.getDomain(request)]["specialFiles"]["__directory__"];
		if (file.length > 0) {
				if (fs.lstatSync(file).isFile()) {
					return self.executeHandler(filename, self, request, response);
				} else {
					self.directoryListing(filename, self, request, response);
				}
		} else {
			self.directoryListing(filename, self, request, response);
		}
	} else {
		self.directoryListing(filename, self, request, response);
	}
};

CGIServer.prototype.directoryListing = function(filename, self, request, response) {
	var relativeFileName = filename.replace(path.normalize(self.config["virtualHosts"][self.getDomain(request)]["documentRoot"]), "");

	if (self.config["directoryListing"] === true) {
		var html = [];

		html.push("<html>");
		html.push("<title>" + relativeFileName + " Listing</title>");
		
		html.push("<h2>");

		var directoryParts = relativeFileName.replace(/^\/|\/$/g, '').split(path.sep);

		for(var i in directoryParts) {
			var link = directoryParts.slice(0, i);
			html.push("<a href='" + link + "'>" + directoryParts[i] + "</a>/");
		}

		html.push("</h2>");

		html.push("<hr>");

		html.push("<h3>");

		html.push("<ul style='list-style-type: none; padding: 0; margin: 0;'>");

		var files = fs.readdirSync(filename);
		for(var i in files) {
			if (fs.lstatSync(filename + "/" + files[i]).isDirectory()) {
				html.push("<li><a href='" + files[i] + "'>" + files[i] + "/</a></li>");
			} else {
				html.push("<li><a href='" + files[i] + "'>" + files[i] + "</a></li>");
			}
		}

		html.push("</ul>");

		html.push("</h3>");

		html.push("<html>");

		html = html.join("\r\n");

		self.send(200, {
			"Content-Type": "text/html",
			"Content-Length": html.length
		}, html, response);

	} else {
		return self.httpError(404, self, request, response);
	}
};

CGIServer.constructEnvArray = function(filename, request, config) {
	/* CGI 1.1 */

	var env = {
		"CONTENT_LENGTH": 	request.headers["content-length"],
		"CONTENT_TYPE": 	request.headers["content-type"],
		"DOCUMENT_ROOT": 	config["documentRoot"],
		"HTTP_HOST": 		request.headers["host"],
		"HTTP_REFERER": 	request.headers["referer"],
		"HTTP_COOKIE": 		"", /* TODO: Fix */
		"HTTP_USER_AGENT": 	request.headers["user-agent"],
		"HTTPS": 			"false", /* TODO: Fix */
		"PATH": 			process.cwd(),
		"QUERY_STRING": 	querystring.stringify(url.parse(request.url, true).query),
		"REMOTE_ADDR": 		request.connection.remoteAddress,
		"REMOTE_HOST": 		request.headers['x-forwarded-for'] || request.connection.remoteAddress,
		"REMOTE_PORT": 		request.headers['x-forwarded-port'],
		"REMOTE_USER": 		"", /* TODO: Fix */
		"REQUEST_METHOD": 	request.method,
		"REQUEST_URI": 		url.parse(request.url).pathname,
		"SCRIPT_FILENAME": 	filename,
		"SCRIPT_NAME": 		"", /* TODO: Fix */
		"SERVER_PORT": 		config["port"],
	};

	for (property in config["cgi"]) {
		env[property] = config["cgi"][property];
	}

	for (property in config["env"]) {
		env[property] = config["env"][property];
	}

	for(property in process.env) {
		env[property] = process.env[property];
	}

	return env;
}

global.CGIServer = CGIServer;