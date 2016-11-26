var express = require('express');
var app = express();
var http = require('http').Server(app);

app.use(express.static(__dirname+"/public"));

//Routing
app.get("*", function(req, res){
	res.sendFile(__dirname+"/public/index.html");
});

//Start server
http.listen(9002, function(){
    console.log("Started editorJQuery on port 9002");
});
