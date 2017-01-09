var express = require('express');
var app = express();
var http = require('http').Server(app);
var fs = require('fs');
var Base64 = require('js-base64').Base64;

app.use(express.static(__dirname+"/public"));

//Routing
app.get("/base64.js", function(req, res){
	res.sendFile(__dirname+"/node_modules/js-base64/base64.js");
}).get("/", function(req, res){
	res.sendFile(__dirname+"/public/index.html");
}).get("/pcm/:id", function(req, res){
	var isLocal = false;
	var isPCM = false;

	try{
		var stat = fs.statSync(__dirname+"/public/pcm/"+req.params.id+".json");
			if(stat.isFile()){
				isLocal = true;
			}
	}catch(e){
		//Nothing to do
	}

	if(!isLocal){
		try{
			var stat = fs.statSync(__dirname+"/public/pcm/"+req.params.id+".pcm");
				if(stat.isFile()){
					isLocal = true;
					isPCM = true;
				}
		}catch(e){
			//Nothing to do
		}
	}

	if(isLocal){
		var path = __dirname+"/public/pcm/"+req.params.id;
		if(!isPCM){
			path += ".json";
		}else{
			path += ".pcm";
		}
		res.sendFile(path);
	}else{
		res.redirect("https://opencompare.org/api/get/"+req.params.id);
	}
});

//Start server
http.listen(9002, function(){
    console.log("Started editorJQuery on port 9002");
});
