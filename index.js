var port = process.env.PORT || 8080;
//var ip = process.env.IP || "127.0.0.1";

var sql = require("sql.js");
var util = require("util");
var express = require("express");
var http = require("http");
var url = require("url");
var WebSocket = require("ws");
var cors = require("cors");
var app = express();

// db setup
// ********
//var db = new sql.Database();
//var sqlstr =
//  "CREATE TABLE log (id INTEGER PRIMARY KEY, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, message text);";
//db.run(sqlstr);

/*app.get("/log", function(req, res) {
  var html = "";
  html +=
    '<style> #t { font-family: "Trebuchet MS", Arial, Helvetica, sans-serif; border-collapse: collapse; width: 100%; } #t td, #t th { border: 1px solid #ddd; padding: 8px; } #t tr:nth-child(even){background-color: #f2f2f2;} #t tr:hover {background-color: #ddd;} #t th { padding-top: 12px; padding-bottom: 12px; text-align: left; background-color: #4CAF50; color: white; } </style>';
  html += '<table id="t">';
  html += "  <tr>";
  html += "    <th>Log Id</th>";
  html += "    <th>Time</th>";
  html += "    <th>Message</th>";
  html += "  </tr>";

  db.each(
    "SELECT id, time, message FROM (SELECT id, time, message FROM log ORDER BY id DESC LIMIT 1000) ORDER BY id ASC;",
    {},
    function(row) {
      html += util.format(
        "<tr><td>%s</td><td>%s</td><td>%s</td></tr>",
        row.id,
        row.time,
        row.message
      );
    }
  );

  html += "</table>";
  res.send(html);
});*/

var httpServer = http.createServer(app);
var wss = new WebSocket.Server({
  server: httpServer,
  clientTracking: true
});

httpServer.listen(port, function listening() {
  log("Bus Tracker Server is running since "+getDateTime()+" and is Listening on port " + httpServer.address().port + " for client connections.");
});

function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + " " + hour + ":" + min + ":" + sec;

}

var ListOfClients = [];
var bus_id_list = [];

wss.on("connection", function connection(ws, req) {
	var location = url.parse(req.url, true);
	var ip = req.connection.remoteAddress;

	var username, bus_id;
  
	log("Client has connected! " + ip);

	ws.on("message", function incoming(jsonMessage) {
		log("received: " + jsonMessage);

		var json = JSON.parse(jsonMessage);

		switch (json.action) {
			case "get bus list":
				//make string list ( + "$" + bus_id_list[i].lat + "$" + bus_id_list[i].lng)
				var strList = "@"; 
				for (i = 0; i < bus_id_list.length; i++) {
					strList += bus_id_list[i].id + "|";
				}
				
				if (strList === '@') {
					ws.send('No busses available for tracking.');
				} else {
					ws.send(strList);
				}
				
				log("Bus ID list sent to " + username + ". List: " + strList);
				break;
			
			case "set bus id":
				bus_id = json.id;
				
				var client = {
					id: json.id,
					lat: json.lat,
					lng: json.lng,
					username: username
				};

				//ID is unique for each bus
				var can_add = true;
				for (i = 0; i < bus_id_list.length; i++) {
					if (bus_id_list[i].id === json.id) {
						can_add = false;
						break;
					}
				}
				if (can_add) {
					bus_id_list.push(client);
					
					//keep the initial socket connection in client list 
					for (i = 0; i < ListOfClients.length; i++) {
					  if (ListOfClients[i].socket === ws) {
						ListOfClients[i].is_bus = true;
						
						var m = "Bus (" + json.id + ") is ready for tracking.";
						
						log(m);
					  }
					}
					
					var m = "Bus tracking enabled successfully. Bus ID: " + json.id;
				
					log(json.message);
					
					// Send to current client
					ws.send(m);
				} else {
					var m = "The bus ID "+ json.id + " is already enabled for tracking. Choose a different and unique ID to enable tracking.";
				
					// Send to current client
					ws.send(m);
				}
				
				break;
				
			case "add user":
				username = json.username;
			
				var client = {
					username: json.username,
					socket: ws,
					is_bus: false,
					track_bus: null
				};
				ListOfClients.push(client);
				var m = "Welcome to Bus Tracker. Your ID: " + json.username;
			
				// Send to current client
				ws.send(m);

				break;
				
			case "get bus location":
				for (i = 0; i < ListOfClients.length; i++) {
				  if (ListOfClients[i].socket === ws) {
					ListOfClients[i].track_bus = json.bus_id;
					
					log(json.message);
					
					ws.send('Bus ID added successfully for tracking.');
				  }
				}
				break;
			
			case "set location":
				/*for (i = 0; i < bus_id_list.length; i++) {
				  if (bus_id_list[i].username === username && bus_id_list[i].id == bus_id) {
					bus_id_list[i].lat = json.lat;
					bus_id_list[i].lng = json.lng;
				  }
				}*/
				
				// Send to current client
				//ws.send('Bus location updated.');

				//update all clients with bus location
				for (i = 0; i < ListOfClients.length; i++) {
				  if (ListOfClients[i].track_bus === json.id) {
					ListOfClients[i].socket.send("$" + "|" + json.id + "|" + json.lat + "|" + json.lng);
				  }
				}
				break;
			}
		});

		// 1. doc says theres no parms. is it?
		// 2. can i use anonymous function?
		ws.on("close", function(code, number) {
		//remove from client list
		for (i = 0; i < ListOfClients.length; i++) {
			if (ListOfClients[i].socket === ws) {
				var u = ListOfClients[i].username;
				ListOfClients.splice(i, 1);

				var m = "client is disconnected: " + u;

				log(m);
			}
		}
		
		//remove from bus id list
		for (i = 0; i < bus_id_list.length; i++) {
			if (bus_id_list[i].username === username && bus_id_list[i].id == bus_id) {
				bus_id_list.splice(i, 1);
			}
		}
	});

	// - can i use anonymous function?
	ws.on("error", function(err) {
		log("Error: " + err);
	});
});

////////////////////////////////////////
// Functions

function getClient(websocket) {
  for (i = 0; i < ListOfClients.length; i++) {
    if (ListOfClients[i].socket === ws) {
		clients.splice(i, 1);
		if (client[i].is_bus === true) {
				
		}
		
		log("remove client");
    }
  }
}

function broadcastMessage(sock, msg) {
  wss.clients.forEach(function each(client) {
    if (client !== sock && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function log(message) {
  console.log(message);
  //var sqlstr =
  //  "INSERT INTO log (id, message) VALUES (NULL, '" + message + "');";
  //db.run(sqlstr);
}
