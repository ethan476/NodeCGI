var cp = require('child_process')
var path = require('path')

function sbclHandler() {

	this.handle = function(filename, request, config, callback) {
		console.log("sbcl --script " + filename)
		child = cp.exec("sbcl --script ./" + filename, {
			"env": CGIServer.constructEnvArray(filename, request, config),
			"timeout": config["timeout"]
		}, function(err, stdout, stderr) {
			if (err) {
				console.log(err)
				return "";
			}

			callback(false, 200, {
				"Content-type:": config["extensions"][".lisp"]["default-content-type"]
			}, stdout);
		});
	}
}

module.exports = new sbclHandler()