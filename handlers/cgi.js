var cp = require('child_process')
var path = require('path')

function cgiHandler() {

	this.handlerName = "cgi";

	this.handlerVersion = 0.1;

	this.handle = function(filename, request, response, config, callback) {
		
		CgiServer.log(this.handlerName + ":" + this.handlerVersion + " - " + "./" + path.normalize(filename));

		child = cp.execFile(filename, {
			"env": CgiServer.constructEnvArray(filename, request, response, config),
			"timeout": config["timeout"]
		}, function(err, stdout, stderr) {
			if (err) {
				console.log(err)
				return "";
			}

			return CgiServer.parseCGIOutput(stdout, path.extname(filename), config, callback);
		});
		request.pipe(child.stdin);
	}
}

module.exports = new cgiHandler();