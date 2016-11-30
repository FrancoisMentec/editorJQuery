var express = require('express');
var app = express();
var http = require('http').Server(app);
var Base64 = require('js-base64').Base64;

app.use(express.static(__dirname+"/public"));

//Routing
app.get("/base64.js", function(req, res){
	res.sendFile(__dirname+"/node_modules/js-base64/base64.js");
}).get("/", function(req, res){
	res.sendFile(__dirname+"/public/index.html");
});

//Start server
http.listen(9002, function(){
    console.log("Started editorJQuery on port 9002");
});
