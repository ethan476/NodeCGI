(format t "Content-Type: text/html~C~C" #\return #\linefeed)

(format t "<form method='post'>Name: <input type='text' name='name'><input type='submit'></form>")

(format t "~@[~a~]" (read-line t nil ""))
