var cp = require('child_process')
var path = require('path')

function sbclHandler() {

	this.handlerName = "sbcl";

	this.handlerVersion = 0.1;

	this.handle = function(filename, request, config, callback) {
		
		console.log(CgiServer.timestampString() + this.handlerName + ":" + this.handlerVersion + " - " + "sbcl --script ./" + path.normalize(filename));

		child = cp.exec("sbcl --script ./" + filename, {
			"env": CgiServer.constructEnvArray(filename, request, config),
			"timeout": config["timeout"]
		}, function(err, stdout, stderr) {
			if (err) {
				console.log(err)
				return "";
			}

			return callback(false, 200, {
				"Content-Type": config["extensions"][".lisp"]["default-content-type"],
				"Content-Length": stdout.length
			}, stdout);
		});
		request.pipe(child.stdin)
		child.stdin.close();
	}
}

module.exports = new sbclHandler()