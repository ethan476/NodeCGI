var cp = require('child_process')
var path = require('path')

function sbclHandler() {

	this.handle = function(filename, request, config, callback) {
		console.log("clisp ./" + filename)
		child = cp.exec("clisp ./" + filename, {
			"env": CGIServer.constructEnvArray(filename, request, config),
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
	}
}

module.exports = new sbclHandler()