var fs = require("fs");
var http = require("http");
var https = require('https');
var path = require("path");
var url = require("url");
const crypto = require('crypto')
var querystring = require('querystring');

function CgiServer(configurationFile, silent) {
	var self = this;

	self.config = require(configurationFile);

	self.servers = [];

	self.usedPorts = [];

	self.hostToDomainTable = {};

	self.sockets = {};

	self.nextSocketId = 0;

	CgiServer.instance = self;

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
					CgiServer.log("Loaded handler for *" + ext);
				}
			});
		}
	}

	if (self.handlers.length == 0) {
		/* No handlers loaded */
		CgiServer.log("Warning: no handlers loaded, only static files will be served.");
	}
}	

CgiServer.prototype.start = function() {
	var self = this;

	for(i in self.config["virtualHosts"]) {
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
   		CgiServer.log("Loaded virtual host: " + self.config["virtualHosts"][i]["domain"] + ":" + self.config["virtualHosts"][i]["port"]);
   	}
};

CgiServer.prototype.stop = function() {
	var self = this;

	CgiServer.log("Stopping server");

	for(var socketId in self.sockets) {
		CgiServer.log("Closed connection to: " + self.sockets[socketId].remoteAddress + ":" + self.sockets[socketId].remotePort);
		self.sockets[socketId].destroy();
	}

	for(var server in self.servers) {
		CgiServer.log("Closed server on " + self.servers[server].address().address + ":" + self.servers[server].address().port);
		self.servers[server].close();
	}
};

CgiServer.prototype.listenOn = function(domain, port) {
	var self = this;
	/* Default Arguments */

	this.loadOptions(domain, function(options, serverType) {

		if (serverType == "http") {
			server = http.createServer(self.handler).listen(port);
		} else {
	    	server = https.createServer(self.handler).listen(port);
		}

		self.servers.push(server);
	    self.usedPorts.push(port);

	    server.on('connection', function (socket) {
	        var socketId = self.nextSocketId++;
	        self.sockets[socketId] = socket;

	        socket.on('close', function () {
	    		delete self.sockets[socketId];
	  		});
	    });

	});
};

CgiServer.prototype.handler = function(request, response) {
	var self = CgiServer.instance;

	var uri = url.parse(request.url).pathname;

	var domain = self.getDomain(request);

	if (domain !== false) {
		var docroot = self.config["virtualHosts"][domain]["documentRoot"];

		var filename = path.join(docroot, uri);

		CgiServer.log(request.method.toUpperCase() + " " + filename + " from " + request.connection.remoteAddress);

		if (!fs.existsSync(filename)) {
			/* File doesn't exist */
			return self.httpError(404, request, response);
		} else if (fs.lstatSync(filename).isDirectory()) {
			/* Load index file or pass to __directory__ handler */
			for(var i in self.config["indexFiles"]) {
				indexFilename = filename + "/" + self.config["indexFiles"][i];
				if (fs.existsSync(indexFilename)) {
					if (fs.lstatSync(indexFilename).isFile()) {
						return self.executeHandler(indexFilename, request, response);
					}
				}
			}

			return self.directory(filename, request, response);
		} else {
			return self.executeHandler(filename, request, response);
		}
	} else {
		/* Whoops, that domain doesn't exist according to the vhosts record, pretend were not home. */
		response.socket.destroy();
	}
}

CgiServer.prototype.loadOptions = function(domain, callback) {
	var options = {};

	var serverType = "http";

	if ("ssl" in domain) {
		if (domain["ssl"]["useSSL"] == true) {

			var key = domain["ssl"]["privateKey"];
			if (key.length != 0 && fs.existsSync(key)) {
				var cert = domain["ssl"]["certificate"];
				if (cert.length != 0 && fs.existsSync(cert)) {
					options["key"] = fs.readFileSync(key);
					options["cert"] = fs.readFileSync(cert);

					serverType = "https";
				} else {
					CgiServer.log("Failed to load cert: " + cert);
				}
			} else {
				CgiServer.log("Failed to load key: " + key);
			}

		}
	}

	callback(options, serverType);
}

CgiServer.prototype.send = function(status, args, data, response) {
	response.writeHead(status, args);
	response.write(data);
	response.end();
};

CgiServer.prototype.serverStatic = function(filename, request, config, callback) {
	fs.readFile(filename, function (err, data) {
		if (err) {
			console.log(err)
		} else {

			CgiServer.log("static:0.1 - " + path.normalize(filename))

			var extName = path.extname(filename);
			var mime = config["staticExtensions"][extName]
			callback(false, 200, {
				"Content-Type": typeof mime !== "undefined" ? mime : "application/octet-stream",
				"Content-Length": data.length
			}, data);
		}
	});
};

CgiServer.prototype.findHandler = function(handlerName, paths, callback) {
	for(var i in paths) {
		var path = paths[i] + "/" + handlerName + ".js";

		if (fs.existsSync(path)) {
			callback(false, require(path));
		} else if (i + 1 = paths.length) {
			callback(new Error("Failed to locate handler: " + handlerName), null);
		}
	}
}

CgiServer.prototype.executeHandler = function(filename, request, response) {
	var self = CgiServer.instance;

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

CgiServer.prototype.getDomain = function(request) {
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

CgiServer.prototype.httpError = function(error, request, response) {
	var self = CgiServer.instance;

	var fileName = "__" + error + "__";

	if (fileName in self.config["virtualHosts"][self.getDomain(request)]["specialFiles"]) {
		var file = path.join(self.config["virtualHosts"][self.getDomain(request)]["documentRoot"], self.config["virtualHosts"][self.getDomain(request)]["specialFiles"][fileName]);

		if (fs.lstatSync(file).isFile() === false) {
			return self.httpErrorLastResort(error, request, response);
		} else {
			return self.executeHandler(file, request, response);
		}
	} else {
		return self.httpErrorLastResort(error, request, response);
	}
};

CgiServer.prototype.httpErrorLastResort = function(error, request, response) {
	self.send(error, {
		"Content-Type": "text/html"
	}, "<h1>Error: " + error + "</h1>", response);
};

CgiServer.prototype.directory = function(filename, request, response) {
	var self = CgiServer.instance;

	if ("__directory__" in self.config["virtualHosts"][self.getDomain(request)]["specialFiles"]) {
		var file = self.config["virtualHosts"][self.getDomain(request)]["specialFiles"]["__directory__"];
		if (file.length > 0) {
				if (fs.lstatSync(file).isFile()) {
					return self.executeHandler(filename, request, response);
				} else {
					self.directoryListing(filename, request, response);
				}
		} else {
			self.directoryListing(filename, request, response);
		}
	} else {
		self.directoryListing(filename, request, response);
	}
};

CgiServer.prototype.directoryListing = function(filename, request, response) {
	var self = CgiServer.instance;

	var relativeFileName = filename.replace(path.normalize(self.config["virtualHosts"][self.getDomain(request)]["documentRoot"]), "");

	if (self.config["directoryListing"] === true) {
		var html = [];

		html.push("<html>");

		var directoryParts = relativeFileName.replace(/^\/|\/$/g, '').split(path.sep);

		html.push("<head>");

		html.push("<title>" + directoryParts[directoryParts.length - 1] + " Directory Listing</title>");
		
		html.push("</head>");

		html.push("<body>")

		html.push("<h2>");

		html.push("<a href='/'>/</a>");

		for(var i in directoryParts) {
			var link = directoryParts.slice(0, i + 1);
			html.push("<a href='" + link + "'>" + directoryParts[i].trim() + "/</a>");
		}

		html.push("</h2>");

		html.push("<hr>");

		html.push("<h3>");

		html.push("<ul style='list-style-type: none; padding: 0; margin: 0;'>");

		var files = fs.readdirSync(filename);
		for(var i in files) {
			if (fs.lstatSync(filename + "/" + files[i]).isDirectory()) {
				html.push("<li><a href='" + relativeFileName + "/" + files[i] + "'>" + files[i] + "/</a></li>");
			} else {
				html.push("<li><a href='" + relativeFileName + "/" + files[i] + "'>" + files[i] + "</a></li>");
			}
		}

		html.push("</ul>");

		html.push("</h3>");

		html.push("</body>")

		html.push("</html>");

		html = html.join("\n");

		self.send(200, {
			"Content-Type": "text/html",
			"Content-Length": html.length
		}, html, response);

	} else {
		return self.httpError(404, request, response);
	}
};


/* Rewrite at some point */
CgiServer.parseCGIOutput = function(stdout, ext, config, callback) {
	var args = {};

	try {
		var status = 200;

		var start = 0;
		var running = true;

		while(running) {
			var i = stdout.indexOf("\r\n", start);
			var string = stdout.substring(start, i);

			if (i == -1 || i == stdout.length || string.length == 0 ) {
				stdout = stdout.substring(start).replace(/^[\r\n]+|\.|[\r\n]+$/g, "");
				running = false;
			} else {

				start = i + 2;

				var split = string.split(":");
				split[1] = split[1].trim();

				if (split.length == 2) {
					if (split[0].toLowerCase() == "status") {
						var newStatus = parseInt(split[1]);

						if (newStatus != NaN) {
							status = newStatus;
						}
					} else {
						args[split[0].toLowerCase()] = split[1];
					}
				}
			}
		}
	} catch(err) {
		console.log(err)
		var status = 200;
		args["content-type"] = config["extensions"][ext]["default-content-type"];
		args["content-length"] = stdout.length;
	} finally {
		if (typeof status == "undefined") {
			status = 200;
		}
		if ("content-type" in args == false) {
			args["content-type"] = config["extensions"][ext]["default-content-type"];
		}
		if ("content-length" in args == false) {
			args["content-length"] = stdout.length;
		}
		return callback(false, status, args, stdout);
	}
}

CgiServer.timestampString = function() {
	var date = "[" + (new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')) + "]: ";
	return date;
}

CgiServer.log = function(text) {
	console.log(CgiServer.timestampString() + text);
}

CgiServer.constructEnvArray = function(filename, request, config) {
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
		"REDIRECT_STATUS": 	"200",
		"REQUEST_TIME": 	new Date().getTime() / 1000,
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

global.CgiServer = CgiServer;