"use strict";

//Dependencies
var express = require('express');
const ngrok = require('ngrok');
var http = require('http');
var nodestatic = require('node-static');
const TelegramBot = require('node-telegram-bot-api');
var proxy = require('express-http-proxy');
var CryptoJS = require('node-cryptojs-aes').CryptoJS;
var sqlite3 = require('sqlite3');
var sys = require('sys');
const SerialPort = require('serialport');

//Config
const key = "d6F3Efeq";
const isEncrypt = true;
var arduinoSerialPort = '/dev/ttyACM0';
const token = '799864144:AAFYArmIUiBmZaUCqxaolRA5Taj3Gnnogds';
const DODalert = 50;
const lowBatAlert = 30;
const loaction= 'Sant Vicenç de Montalt, C/ Sol Naixent';

//Variables
const bot = new TelegramBot(token, { polling: true });
var app = express();
var db = new sqlite3.Database('./piBat.db');
const Readline = SerialPort.parsers.Readline;
const port = new SerialPort(arduinoSerialPort);
const parser = new Readline();
port.pipe(parser);
var staticServer = new nodestatic.Server(".");
var restUrl;
var restID;
var sshUrl;
var cell = 'NaN';
var batVolt = NaN;
var batPercent = NaN;
var date = NaN;
var chatId = NaN;
var dodFlag = false;
var lowFlag = false;

//Constants

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
	// 'msg' is the received Message from Telegram
	// 'match' is the result of executing the regexp above on the text content
	// of the message

	chatId = msg.chat.id;
	const resp = match[1]; // the captured "whatever"


	const baseURL = 'http://saiio.000webhostapp.com/#/cell/';

	// send back the matched "whatever" to the chat
	bot.sendMessage(chatId, baseURL + restID);
});

//Connect ngrok to rest API
(async function () {
	restUrl = await ngrok.connect({
		proto: 'http',
		addr: 8001,
		authtoken: '22Ywb26viDtAwYjnouhBp_3CmqyRhsJ1tWC3qxzRbwq'
	});
	console.log("Ngrok connected [localhost:8001] at url: [" + restUrl + "]");
	restID = restUrl.split('/')[2].split('.')[0];
})();

//Connect ngrok to SSH
(async function () {
	sshUrl = await ngrok.connect({
		proto: 'tcp',
		addr: 22,
		authtoken: '22Ywb26viDtAwYjnouhBp_3CmqyRhsJ1tWC3qxzRbwq'
	});
	console.log("Ngrok connected [localhost:22] at url: [" + sshUrl + "]");
})();

app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

app.get('/data', (req, res) => {
	res.send(cell);
});

app.get('/:data', function (request, response) {
	// Grab the URL requested by the client and parse any query options
	var url = require('url').parse(request.url, true);
	var pathfile = url.pathname;
	var query = url.query;

	// Test to see if it's a database query
	if (pathfile == '/battery_query.json') {
		// Test to see if number of observations was specified as url query
		if (query.num_obs) {
			var num_obs = parseInt(query.num_obs);
		}
		else {
			// If not specified default to 20. Note use -1 in query string to get all.
			var num_obs = -1;
		}
		if (query.start_date) {
			var start_date = query.start_date;
		}
		else {
			var start_date = '1970-01-01T00:00';
		}
		// Send a message to console log
		console.log('Database query request from ' + request.connection.remoteAddress + ' for ' + num_obs + ' records from ' + start_date + '.');
		// call selectBat function to get data from database
		selectBat(num_obs, start_date, function (data) {
			response.writeHead(200, { "Content-type": "application/json" });
			response.end(encrypt(JSON.stringify(data)), "ascii");
		});
		return;
	}

	// Test to see if it's a request for current battery   
	if (pathfile == '/battery_now.json') {
		readBat(function (data) {
			response.writeHead(200, { "Content-type": "application/json" });
			response.end(encrypt(JSON.stringify(data)), "ascii");
		});
		return;
	}

	// Handler for favicon.ico requests
	if (pathfile == '/favicon.ico') {
		response.writeHead(200, { 'Content-Type': 'image/x-icon' });
		response.end();

		// Optionally log favicon requests.
		//console.log('favicon requested');
		return;
	} else {
		// Print requested file to terminal
		console.log('Request from ' + request.connection.remoteAddress + ' for: ' + pathfile);

		// Serve file using node-static			
		staticServer.serve(request, response, function (err, result) {
			if (err) {
				// Log the error
				sys.error("Error serving " + request.url + " - " + err.message);

				// Respond to the client
				response.writeHead(err.status, err.headers);
				response.end('Error 404 - file not found');
				return;
			}
			return;
		})
	}
});

app.use('/icecast', proxy('http://localhost:8000'));

http.createServer(app).listen(8001, () => {
	console.log('Server started at http://localhost:8001');
});

parser.on('data', function (data) {//When a new line of text is received from Arduino over USB
	try {
		var myJsonObject = JSON.parse(data); //change to obj
		batVolt = parseInt(myJsonObject.bat * 1142 / 5070, 10);
		batPercent = batVoltToPercent(batVolt / 1000);
		manageTelegramBatPercent(batPercent);
		date = new Date();
		myJsonObject.dateLastInfo = date;
		myJsonObject.id = restID;
		myJsonObject.batVolt = batVolt;
		myJsonObject.batPercent = batPercent;
		data = JSON.stringify(myJsonObject);
		cell = encrypt(data);
	}
	catch (ex) {
		console.warn(ex);
	}
});

const encrypt = (text) => {
	if (isEncrypt) {
		try {
			return CryptoJS.AES.encrypt(text, key).toString();
		} catch (ex) {
			console.log(ex);
		}
	} else {
		return text;
	}
	
}

function insertBat(data) {
	// data is a javascript object   
	var statement = db.prepare("INSERT INTO battery_records VALUES (?, ?)");
	// Insert values into prepared statement
	statement.run(data.battery_record[0].unix_time, data.battery_record[0].charge);
	// Execute the statement
	statement.finalize();
}

function readBat(callback) {
	// Add date/time to battery
	var data = {
		battery_record: [{
			unix_time: Date.now(),
			charge: batPercent
		}]
	};
	// Execute call back with data
	callback(data);
};

function logBat(interval) {
	// Call the readBat function with the insertBat function as output to get initial reading
	readBat(insertBat);
	// Set the repeat interval (milliseconds). Third argument is passed as callback function to first (i.e. readBat(insertBat)).
	setInterval(readBat, interval, insertBat);
};

function selectBat(num_records, start_date, callback) {
	// - Num records is an SQL filter from latest record back trough time series, 
	// - start_date is the first date in the time-series required, 
	// - callback is the output function
	var current_bat = db.all("SELECT * FROM (SELECT * FROM battery_records WHERE unix_time > (strftime('%s',?)*1000) ORDER BY unix_time DESC LIMIT ?) ORDER BY unix_time;", start_date, num_records,
		function (err, rows) {
			if (err) {
				response.writeHead(500, { "Content-type": "text/html" });
				response.end(err + "\n");
				console.log('Error serving querying database. ' + err);
				return;
			}
			var data = { battery_record: [rows] }
			callback(data);
		});
};

// Start battery logging (every 5 min).
var msecs = (60 * 5) * 1000; // log interval duration in milliseconds
logBat(msecs);
// Send a message to console
console.log('Server is logging to database at ' + msecs + 'ms intervals');

function batVoltToPercent(voltage) {
	if(voltage<11.8){
		return 0;
	}else if (voltage >= 11.8 && voltage <12){
		let M = (25+11.8)/12;
		let N = -11.8 * M;
		return Math.round(M*voltage + N);
	}else if (voltage >= 12 && voltage <12.2){
		let M = (55+12)/12.2;
		let N = -12 * M;
		return Math.round(M*voltage + N);
	}else if (voltage >= 12.2 && voltage <12.4){
		let M = (75+12.2)/12.4;
		let N = -12.2 * M;
		return Math.round(M*voltage + N);
	}else {
		return 100;
	}
}

function manageTelegramBatPercent(batPerc){
	if (batPerc < DODalert && !dodFlag) {
		dodFlag = true;
		if (chatId){
			bot.sendMessage(chatId, '[Atenció] El nivell de bateria de '+loaction+' ha baixat del '+batPerc+'%, mes informació: ' + baseURL + restID);
		}
	} else {
		dodFlag= false;
	}
	if (batPerc < lowBatAlert && !lowFlag) {
		lowFlag = true;
		if (chatId){
			bot.sendMessage(chatId, '[Alerta] El nivell de bateria de '+loaction+' ha baixat del '+batPerc+'%, mes informació: ' + baseURL + restID);
		}
	}else{
		lowFlag = false;
	}
}