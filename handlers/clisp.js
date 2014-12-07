var cp = require('child_process')
var path = require('path')

function clispHandler() {

	this.handlerName = "clisp";

	this.handlerVersion = 0.1;

	this.handle = function(filename, request, config, callback) {
		
		console.log(CgiServer.timestampString() + this.handlerName + ":" + this.handlerVersion + " - " + "clisp ./" + path.normalize(filename));

		child = cp.exec("clisp ./" + filename, {
			"env": CgiServer.constructEnvArray(filename, request, config),
			"timeout": config["timeout"]
		}, function(err, stdout, stderr) {
			if (err) {
				console.log(err)
				return "";
			}

			return CgiServer.parseCGIOutput(stdout, path.extname(filename), config, callback);

/*
				callback(false, 200, {
				"Content-Type": config["extensions"][".lisp"]["default-content-type"],
				"Content-Length": stdout.length
			}, stdout);
				*/
		});
		request.pipe(child.stdin)
	}
}

module.exports = new clispHandler()
