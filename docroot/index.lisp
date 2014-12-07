;Headers Start

(format t "Content-Type: text/plain~C~C" #\return #\linefeed)

;(format t "~C~C" #\return #\linefeed)

;Headers End

(format t "<form method='post'>Name: <input type='text' name='name'><input type='submit'></form>")

(format t "~@[~a~]" (read-line t nil ""))
