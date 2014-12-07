var cp = require('child_process')
var path = require('path')

function phpHandler() {

	this.handlerName = "php";

	this.handlerVersion = 0.1;

	this.handle = function(filename, request, config, callback) {
		
		console.log(CgiServer.timestampString() + this.handlerName + ":" + this.handlerVersion + " - php-cgi -q -c " + config["extensions"][".php"]["iniPath"] + " " + path.normalize(filename));

		child = cp.exec("php-cgi -q -c " + config["extensions"][".php"]["iniPath"] + " " + path.normalize(filename), {
			"env": CgiServer.constructEnvArray(filename, request, config),
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

module.exports = new phpHandler()