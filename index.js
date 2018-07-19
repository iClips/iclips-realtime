// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var port = process.env.PORT || 8080 || 80,
    ip   = process.env.IP   || '0.0.0.0' || '127.0.0.1';

try {
	server.listen(port, ip);
} catch (err) {
	console.log('Listening to socket connection requests cause ERROR at time ' + getDateTime() + ' on http://%s:%s', ip, port);
	console.log(err.message);
}
console.log('Iclips-server is running since ' + getDateTime() + ' on http://%s:%s', ip, port);

// Routing
app.get('/', function (req, res) {
	res.send('Welcome, ' + req.headers['user-agent']);
})

var numUsers = 0;
var ListOfClients = [];
var bus_id_list = [];

io.on('connection', function (socket) {
	
	numUsers++;
	console.log(numUsers + " clients connected!");
	
	socket.on('add user', function (username) {
		//we have to make sure the this list always contains only one reference to the user
		var client = {	
			username: username,
			socket: socket
		};
		ListOfClients.push(client);
		
		var m = "Welcome " + username + ". You are now connected on I Clips in real-time communication.";
	
		// Send to current client
		socket.emit('user added', m);
		
		//log username to console
		console.log(username + ' connected at ' + getDateTime());
	});
	
	
	socket.on('disconnect', function () {
		removeClient(socket);
	});
});

/*================ FUNCTIONS START ===========================*/

function removeClient(ws) {
	numUsers--;
}

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

var isEqual = function (value, other) {

	// Get the value type
	var type = Object.prototype.toString.call(value);

	// If the two objects are not the same type, return false
	if (type !== Object.prototype.toString.call(other)) return false;

	// If items are not an object or array, return false
	if (['[object Array]', '[object Object]'].indexOf(type) < 0) return false;

	// Compare the length of the length of the two items
	var valueLen = type === '[object Array]' ? value.length : Object.keys(value).length;
	var otherLen = type === '[object Array]' ? other.length : Object.keys(other).length;
	if (valueLen !== otherLen) return false;

	// Compare two items
	var compare = function (item1, item2) {

		// Get the object type
		var itemType = Object.prototype.toString.call(item1);

		// If an object or array, compare recursively
		if (['[object Array]', '[object Object]'].indexOf(itemType) >= 0) {
			if (!isEqual(item1, item2)) return false;
		}

		// Otherwise, do a simple comparison
		else {

			// If the two items are not the same type, return false
			if (itemType !== Object.prototype.toString.call(item2)) return false;

			// Else if it's a function, convert to a string and compare
			// Otherwise, just compare
			if (itemType === '[object Function]') {
				if (item1.toString() !== item2.toString()) return false;
			} else {
				if (item1 !== item2) return false;
			}

		}
	};

	// Compare properties
	if (type === '[object Array]') {
		for (var i = 0; i < valueLen; i++) {
			if (compare(value[i], other[i]) === false) return false;
		}
	} else {
		for (var key in value) {
			if (value.hasOwnProperty(key)) {
				if (compare(value[key], other[key]) === false) return false;
			}
		}
	}

	// If nothing failed, return true
	return true;

};

/*================ FUNCTIONS END ==============================*/