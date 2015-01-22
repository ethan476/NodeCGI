var cp = require('child_process')
var path = require('path')

function clispHandler() {

	this.handlerName = "clisp";

	this.handlerVersion = 0.1;

	this.handle = function(filename, request, response, config, callback) {
		
		CgiServer.log(this.handlerName + ":" + this.handlerVersion + " - " + "clisp ./" + path.normalize(filename));

		var body = "";
		request.on('data', function (chunk) {
  	  		body += chunk;

  	  		if (body.length > 1e6) {
  	  			/* Todo: send HTTP 413 */
  	  			request.connection.destroy();
  	  		}
  		});
  
  		request.on('end', function () {
    		body = decodeURIComponent(body.replace(/\+/g, ' '));
    		
    		if (body[body.length - 1] !== '\n') {
    			body += '\n';
    		}

    		child = cp.exec("clisp ./" + filename, {
				"env": CgiServer.constructEnvArray(filename, request, response, config),
				"timeout": config["timeout"]
			}, function(err, stdout, stderr) {
				if (err) {
					console.log(err)
					return "";
				}

				return CgiServer.parseCGIOutput(stdout, path.extname(filename), config, callback);
			});

			child.stdin.write(body);
  		});




		//request.pipe(process.stdin);
		//request.pipe(child.stdin);
	}
}

module.exports = new clispHandler();
