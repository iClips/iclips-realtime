var port = process.env.PORT || 8080;
var ip   = process.env.IP   || '127.0.0.1';

var util = require('util');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

// db setup
var sql = require('sql.js');
var db = new sql.Database();
var sqlstr = "CREATE TABLE log (id INTEGER PRIMARY KEY, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, message text);";
db.run(sqlstr);

server.listen(port, ip, function () {
  console.log('Server running on http://%s:%s', ip, port);
  log(util.format('Server running on http://%s:%s', ip, port));
});

app.get('/log', function (req, res) {

	var html = "";
	html += "<style> #t { font-family: \"Trebuchet MS\", Arial, Helvetica, sans-serif; border-collapse: collapse; width: 100%; } #t td, #t th { border: 1px solid #ddd; padding: 8px; } #t tr:nth-child(even){background-color: #f2f2f2;} #t tr:hover {background-color: #ddd;} #t th { padding-top: 12px; padding-bottom: 12px; text-align: left; background-color: #4CAF50; color: white; } </style>";
	html += "<table id=\"t\">";
	html += "  <tr>";
	html += "    <th>Log Id</th>";
	html += "    <th>Time</th>";
	html += "    <th>Message</th>";
	html += "  </tr>";
	
	db.each("SELECT id, time, message FROM (SELECT id, time, message FROM log ORDER BY id DESC LIMIT 1000) ORDER BY id ASC;", {}, function(row) {
		html += util.format("<tr><td>%s</td><td>%s</td><td>%s</td></tr>", row.id, row.time, row.message);
	});
	
	html += "</table>";
	res.send(html);
});

var ids = [];

// Chatroom

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;
		
io.sockets.on('connection', function (client) {
	var addedUser = false;
    var address = client.handshake;
		
	log("connection: " + client);
	var friends = "";
	var session = "";
	var str = "";
	
	// when the client emits 'add user', this listens and executes
 	client.on('add user', function (username) {

		// we store the username in the socket session for this client
		client.username = username;
                ids.push({"id":client.id, "username":username});

		// add the client's username to the global list
		usernames[username] = username;
		++numUsers;
		addedUser = true;

		client.emit('user added', username);
		str = "<user added> called on client where username=" + username + " address=" + address.address;
		console.log(str);
		session = session + str + "\r";
	});
	
	//notify recording...
	client.on('video recording', function (fname) {
			str = "<video recording> friend signal from=" + client.username + " to=" + fname;
           	console.log(str);
			session = session + str + "\r";
			
			// we tell the client to execute 'new message'
	       var id = getUserId(ids, "username", fname);
	       if (id != null) {
				io.sockets.connected[ids[id]["id"]].emit('video recording', client.username);
	                str = "<video recording> from=" + client.username + " to=" + fname;
	                console.log(str);
	                session = session + str + "\r";
			} else {
	                client.emit('socket feedback', fname + " is offline");
	                str = "<video recording> friend offline: " + client.username + " to=" + fname;
	                console.log(str);
	                session = session + str + "\r";
	        }
	});
	//notify recording stopped
	client.on('video recording stopped', function (fname) {
		str = "<video recording stopped> friend signal from=" + client.username + " to=" + fname;
		console.log(str);
		session = session + str + "\r";
		
		// we tell the client to execute 'new message'
               var id = getUserId(ids, "username", fname);
               if (id != null) {
					io.sockets.connected[ids[id]["id"]].emit('video recording stopped', client.username);
                    str = "<video recording stopped> from=" + client.username + " to=" + fname;
                    console.log(str);
                    session = session + str + "\r";
				} else {
                        client.emit('socket feedback', fname + " is offline");
                        str = "<video recording stopped> friend offline: " + client.username + " to=" + fname;
                        console.log(str);
                        session = session + str + "\r";
                }
	});
	
	//notify new status clip to my friends
	client.on('notify new status clip', function (friends) {
		friends = friends;
		str = "<notify new status clip>  from=" + client.username + " friends=" + friends;
		console.log(str);
		session = session + str + "\r";
		
		// emit to friends socket feedback
		var fs = friends.split("|");
		if (fs !== null){
			for (var i = 0; i < fs.length; i++) {
				var id = getUserId(ids, "username", fs[i]);
				if (fs[i].length > 0) {
					if (id !== null) {
						io.sockets.connected[ids[id]["id"]].emit('new status clip', client.username);
						io.sockets.connected[ids[id]["id"]].emit('socket feedback', client.username + " have a new status clip.");
						client.emit('socket feedback', fs[i] + " is notified");
					} else {
						client.emit('socket feedback', fs[i] + " is offline");
					}			
				}	
			}
			client.emit('socket feedback', "action completed successfully");
			str = "<notify new status clip> notifying action completed successfully username=" + client.username;
			console.log(str);
			session = session + str + "\r";
		}
	});
	
	//send feedback to specific friend
	client.on('feedback to friend', function (data) {
		//get params from json 
		var obj = JSON.parse(data);
		var fn = obj.friend;
		var feed = obj.feed;
			
		str = "<feedback to friend> ***START*****friend signal from=" +
		   fn + " feed=" + feed;
		console.log(str);
		session = session + str + "\r";
		
		// we tell the client to execute 'new message'
		var id = getUserId(ids, "username", fn);
		if (id != null) {
			io.sockets.connected[ids[id]["id"]].emit('socket feedback', feed);
			str = "<feedback to friend> friend online: from=" + fn + " feed=" + feed;
			console.log(str);
			session = session + str + "\r";
			client.emit('socket feedback', fn + " received your profile photo update notification");
		} else {
			client.emit('socket feedback', fn + " is offline");
			str = "<feedback to friend> friend offline: from=" + fn + " feed=" + feed; 
			session = session + str + "\r";
			console.log(str);
			
		}
		str = "<feedback to friend> ***END*****friend signal from=" + fn + " feed=" + feed;
		console.log(str);
		session = session + str + "\r";
	}); 

	
	//when user have updated invites table with friend invitation to this friend
	client.on('invite friend', function (fname) {
			str = "<invite friend> friend signal from=" + client.username + " to=" + fname;
	       	console.log(str);
			session = session + str + "\r";
			
			// we tell the client to execute 'new message'
               var id = getUserId(ids, "username", fname);
               if (id != null) {
			io.sockets.connected[ids[id]["id"]].emit('message service', "");
                        str = "client: invite friend signal message service online: " + client.username + " to=" + fname;
                        console.log(str);
                        session = session + str + "\r";
			} else {
                        client.emit('socket feedback', fname + " is offline");
                        str = "<invite friend> friend offline: " + client.username + " to=" + fname;
                        console.log(str);
                        session = session + str + "\r";
            }
	});
	  
       //invite accepted
	client.on('invite accepted', function (fname) {
               str = "<invite accepted> friend signal from=" + client.username + " to=" + fname;
               console.log(str);
               session = session + str + "\r";

				// we tell the client to execute 'new message'
               var id = getUserId(ids, "username", fname);
               if (id != null) {
					io.sockets.connected[ids[id]["id"]].emit('message service', "");
                        str = "<invite accepted> friend signal message service from=" + client.username + " to=" + fname;
                        console.log(str);
                        session = session + str + "\r";
			} else {
                        client.emit('socket feedback', fname + "is offline");
                        str = "<invite accepted> friend offline: " + client.username + " to=" + fname;
                        console.log(str);
                        session = session + str + "\r";
                }
	});
      //video share
	client.on('video share', function (fname) {
               str = "<video share> friend signal from=" + client.username + " to=" + fname;
               console.log(str);
               session = session + str + "\r";

		// we tell the client to execute 'new message'
               var id = getUserId(ids, "username", fname);
               if (id != null) {
					io.sockets.connected[ids[id]["id"]].emit('socket feedback', "receiving video message from " + client.username);
					io.sockets.connected[ids[id]["id"]].emit('message service', "");
                        client.emit('socket feedback', fname + " is notified");
                        str = "<video share> friend signal message service from=" + client.username + " to=" + fname;
                        console.log(str);
                        session = session + str + "\r";
				} else {
                        client.emit('socket feedback', fname + " is offline");
                        str = "<video share> friend offline: " + client.username + " to=" + fname;
                        console.log();
                        session = session + str + "\r";
                }
	});
      //video received
	client.on('video received', function (fname, vname) {
			str = "<video received> friend signal from=" + client.username + " to=" + fname + " video name=" + vname;
           	console.log(str);
			session = session + str + "\r";
		// we tell the client to execute 'new message'
               var id = getUserId(ids, "username", fname);
               if (id != null) {
					io.sockets.connected[ids[id]["id"]].emit('socket feedback', client.username +
						" received " + vname);
					str = "<video received> friend online: from=" + client.username + " to=" + fname;
					console.log(str);
					session = session + str + "\r";
				} else {
                        client.emit('socket feedback', fname + " is offline");
       					str = "<video received> friend offline: from=" + client.username + " to=" + fname;
       					console.log(str);
       					session = session + str + "\r";
                }
	});       
	//notify online
	client.on('notify online', function (fnds) {
				friends = fnds;
				str = "<notify online>  from=" + client.username + " friends=" + friends;
           		//console.log(str);
               session = session + str + "\r";

			// notify friends and get onliners
			var fs = friends.split("|");
			var onliners = "";			
			for (var i = 0; i < fs.length; i++) {
				var id = getUserId(ids, "username", fs[i]);
				if (id != null) {
					onliners = onliners + fs[i] + "|";
					io.sockets.connected[ids[id]["id"]].emit('socket feedback', "online notification from " + client.username);
					io.sockets.connected[ids[id]["id"]].emit('notify online', client.username + "|");
					str = "<notify online> friend signal online from=" + client.username + " to=" + fs[i];	
					//console.log(str);
					session = session + str + "\r";
				} 			
			}
			client.emit('notify online', onliners);
			str = "<notify online> emitting onliners back to client from=" + client.username + " onliners=" + onliners;
			session = session + str + "\r";
			console.log(session);
	});
	//notify offline
	client.on('notify offline', function (friends) {
               str = "<notify offline>  from=" + client.username + " friends=" + friends;
               console.log(str);
               session = session + str + "\r";

		// notify friends I'm offline
		var fs = friends.split("|");
		for (var i = 0; i < fs.length; i++) {
			var id = getUserId(ids, "username", fs[i]);
			if (fs[i].length > 0) {
				if (id != null) {
					io.sockets.connected[ids[id]["id"]].emit('socket feedback', "offline notification from " + client.username);
					io.sockets.connected[ids[id]["id"]].emit('notify offline', client.username);
				        str = "<notify offline> friend signal offline from=" + client.username + " to=" + fs[i];
				        console.log(str);
				        session = session + str + "\r";
				} 			
			}
		}
				str = "<notify offline> emitted offline to friends from=" + client.username + " friends=" + friends;
               console.log(str);
               session = session + str + "\r";
	});
         //heatbeats
	client.on('heartbeat', function (hbeat) {
            str = "<heartbeat>" + hbeat + client.username;
            console.log(str);
			session = session + str + "\r";
			// we emit same hbeat back to client
			client.emit('heartbeat', hbeat);
	});

        //notify updated profile to my friends
	client.on('update profile', function (fnds) {
			friends = fnds;
			str = "<update profile>  from=" + client.username + " friends=" + friends;
           	console.log(str);
			session = session + str + "\r";
			
			// emit to friends socket feedback
			var fs = friends.split("|");
	                if (fs != null){
	                    for (var i = 0; i < fs.length; i++) {
				var id = getUserId(ids, "username", fs[i]);
				if (fs[i].length > 0) {
					if (id != null) {
						io.sockets.connected[ids[id]["id"]].emit('socket feedback', "new profile photo notification from " + client.username);
						io.sockets.connected[ids[id]["id"]].emit('message service', client.username);
					        str  = "<update profile> friend signal to socket feedback and message service from=" + client.username + " to=" + fs[i];
					        console.log(str);
					        session = session + str + "\r";
					} else {
					        client.emit('socket feedback', fs[i] + " is offline");
					}			
				}
			}
               client.emit('socket feedback', "action completed successfully");
               str = "<update profile> notifying action completed successfully back to client username=" + client.username;
               console.log(str);  
              session = session + str + "\r";
    }
		
	});
	  
	  // when the user disconnects.. perform this
	  client.on('disconnect', function () {
			// remove the username from global usernames list
			str = "<disconnect> client is now offline: " + client.username;
			console.log(str);
			session = session + str + "\r";
			
			if (addedUser) {
				//notify offline to friends
				str = "<disconnect> friends=" + friends;
				console.log(str);
				session = session + str + "\r";
				
				var fs = friends.split("|");
				for (var i = 0; i < fs.length; i++) {
					var id = getUserId(ids, "username", fs[i]);
					if (id != null && io.sockets.connected[ids[id]["id"]] != null) {
							io.sockets.connected[ids[id]["id"]].emit('socket feedback', "offline notification from " + client.username);
						io.sockets.connected[ids[id]["id"]].emit('notify offline', client.username + "|");
					        str = "<notify offline> from=" + client.username + " to=" + fs[i];
					        console.log(str);
					        session = session + str + "\r****************///////////////********************\r\r";
					} 
				}
				
				//write to clients file
				//writeTextFile("/clients/session_logs/" + client.username + ".txt", session);
				console.log(session);
				
				addedUser = false;
				var i = getUserId(ids, "username", client.username);
				if (i != null) {
					ids.splice(i, 1);	
				}
				delete usernames[client.username];
				  --numUsers;
			}
	  });
});

function getUserId(arr, key, value) {
   for (var i = 0; i < arr.length; i++) {
         if (arr[i][key] == value) {
                  return i;
         }   
    }   
	return null;
}

//////////////////////////////////////////////////// 
 /** 
  * writeTextFile write data to file on hard drive 
  * @param  string  filepath   Path to file on hard drive 
  * @param  sring   output     Data to be written 
  */ 
 function writeTextFile(path, output) { 
	 	var fs = require('fs');

		fs.ensureFile(path, function(err) {
		  if (!err) {
		    fs.writeFile(path, output);
		  } else {
		  	console.log("error writing to file" + output);
		  }
		});
 } 
 
 
 //////////////////////////////////////////////////// 
 /** 
  * readTextFile read data from file 
  * @param  string   filepath   Path to file on hard drive 
  * @return string              String with file data 
  */ 
 function readTextFile(filepath) { 
 	var str = ""; 
 	var txtFile = new File(filepath); 
 	txtFile.open("r"); 
 	while (!txtFile.eof) { 
 		// read each line of text 
 		str += txtFile.readln() + "\n"; 
 	} 
 	return str; 
} 

function log(message) {
	console.log(message);
	var sqlstr = "INSERT INTO log (id, message) VALUES (NULL, '" + message + "');";
	db.run(sqlstr);
}