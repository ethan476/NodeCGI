var fs = require("fs");
var http = require("http");
var path = require("path");
var url = require("url");

function CGIServer(configurationFile, port) {
	var self = this;

	self.config = require(configurationFile);
	self.port = port;

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
				}
			});
		}
	}

	if (self.handlers.length == 0) {
		/* No handlers loaded */
		console.log("Warning: no handlers loaded");
	}

	console.log(self.handlers)
}	

CGIServer.prototype.listen = function(port) {
	var self = this;
	/* Default Arguments */
	this.port = typeof port !== 'undefined' ? port : this.config["port"];

    this.server = http.createServer(function(request, response) {
		var uri = url.parse(request.url).pathname;

		var filename = path.join(self.config["documentRoot"], uri);

		if (!fs.existsSync(filename)) {
			/* File doesn't exist */
			return;
		}

		if (fs.lstatSync(filename).isDirectory()) {
			/* Load index file or pass to __directory__ handler */
		} else {
			self.executeHandler(self, filename, request, response, self.send)
		}
	}).listen(this.port);
    
    this.server.on('connection', function (socket) {
        if (typeof this.sockets === "undefined") {
            this.sockets = new Array();
        }
        this.sockets.push(socket);
    });
};

CGIServer.prototype.send = function(status, args, data, response) {
	response.writeHead(status, args);
	response.write(data);
	response.end();
};

CGIServer.prototype.serverStatic = function(filename, request, config, callback) {
	fs.readFile(filename, 'utf-8', function (err, data) {
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

CGIServer.prototype.executeHandler = function(self, filename, request, response, callback) {
	var extName = path.extname(filename);
	
	if (!extName) {
		/* File has no extension, assume static... */
		return self.serverStatic(filename, request, self.config, function(err, status, args, data) {
			if (err) {
				/* Hmm, what now? */
			}
			callback(status, args, data, response);
		});
	} else if (extName in self.config["staticExtensions"]) {
		return self.serverStatic(filename, request, self.config, function(err, status, args, data) {
			if (err) {
				/* Hmm, what now? */
			}
			callback(status, args, data, response);
		});
	} else if (extName in self.handlers == false) {
		/* No extension handler, send 500 error */
		return callback("500", {}, "", response);
	} else {

		var handler = self.handlers[extName];

		handler.handle(filename, request, self.config, function(err, status, args, data) {
			if (err) {
				/* Hmm, what now? */
			}
			callback(status, args, data, response);
		});
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
		"QUERY_STRING": 	url.parse(request.url, true).query,
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