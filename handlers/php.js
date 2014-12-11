var cp = require('child_process')
var path = require('path')

function phpHandler() {

	this.handlerName = "php";

	this.handlerVersion = 0.1;

	this.handle = function(filename, request, response, config, callback) {
		
		CgiServer.log(this.handlerName + ":" + this.handlerVersion + " - php-cgi -c " + config["extensions"][".php"]["iniPath"] + " " + path.normalize(filename));

		//-
		child = cp.exec("php-cgi -c " + config["extensions"][".php"]["iniPath"], {
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

module.exports = new phpHandler()