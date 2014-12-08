;Headers Start

(format t "Content-Type: text/html~C~C" #\return #\linefeed)

(format t "~C~C" #\return #\linefeed)

;Headers End

(format t 
"<html>
	<head>

	</head>

	<body>
		<form method='post'>Name: <input type='text' name='name'><input type='submit'></form>
		~@[~a~]
	</body>
</html>"
(read-line t nil ""))