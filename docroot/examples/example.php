<?php
	session_start();

	print_r(file_get_contents("php://input"));

	print_r($_POST);

	if (!empty($_POST)) {
		$_SESSION["name"] = $_POST["name"];
	}

?>

<html>
	<head>
		<title>PHP Example</title>
	</head>
	<body>
		<?php 
			if (isset($_SESSION["name"])) {
		?>
			Your name is: <?php echo $_SESSION["name"]; ?>
		<?php 
			} else {
		?>
		<form method="post">
			Name: <input type="text" name="name" enctype="multipart/form-data">
			<input type="submit">
		</form>
		<?php 
			}
		?>
	</body>
</html>
