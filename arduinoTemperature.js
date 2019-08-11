"use strict";

var express = require('express');
const ngrok = require('ngrok');
var http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const token = 'ask for token';
const bot = new TelegramBot(token, {polling: true});
var app = express();
var proxy = require('express-http-proxy');
var arduinoSerialPort = '/dev/ttyACM0';	//Serial port over USB connection between the Raspberry Pi and the Arduino
var CryptoJS = require('node-cryptojs-aes').CryptoJS;
var sqlite3 = require('sqlite3');
var fs = require('fs');
var db = new sqlite3.Database('./piBat.db');
const key = "d6F3Efeq";
const isEncrypt = true;

var restUrl;
var restID;
var sshUrl;

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
	// 'msg' is the received Message from Telegram
	// 'match' is the result of executing the regexp above on the text content
	// of the message
  
	const chatId = msg.chat.id;
	const resp = match[1]; // the captured "whatever"


	const baseURL= 'http://saiio.000webhostapp.com/#/cell/';
  
	// send back the matched "whatever" to the chat
	bot.sendMessage(chatId, baseURL + restID);
  });

//Connect ngrok to rest API
(async function () {
    restUrl = await ngrok.connect({
		proto : 'http',
		addr : 8001,
		authtoken : '22Ywb26viDtAwYjnouhBp_3CmqyRhsJ1tWC3qxzRbwq'
	});
    console.log("Ngrok connected [localhost:8001] at url: ["+restUrl+"]");
	restID = restUrl.split('/')[2].split('.')[0];
})();

//Connect ngrok to SSH
(async function () {
    sshUrl = await ngrok.connect({
		proto : 'tcp',
		addr : 22,
		authtoken : '22Ywb26viDtAwYjnouhBp_3CmqyRhsJ1tWC3qxzRbwq'
	});
    console.log("Ngrok connected [localhost:22] at url: ["+sshUrl+"]");
})();

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
  });

app.get('/data', (req, res) => {
	res.send(cell);
});

app.use('/icecast', proxy('http://localhost:8000'));

http.createServer(app).listen(8001, () => {
	console.log('Server started at http://localhost:8001');
  });

const SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;
const port = new SerialPort(arduinoSerialPort);
const parser = new Readline();
port.pipe(parser);

var bat = NaN
var temp = NaN;
var hum = NaN;
var lat = NaN;
var long = NaN;
var alt = NaN;
var raw = NaN;
var rzero = NaN;
var ppm = NaN;
var dateLastInfo = new Date(0);
var dataS = NaN;

var cell = NaN;

parser.on('data', function (data)
{//When a new line of text is received from Arduino over USB
	try
	{
		var myJsonObject = JSON.parse(data); //change to obj
		myJsonObject.dateLastInfo = new Date(); //add something
		myJsonObject.id = restID;
		myJsonObject.bat = parseInt(myJsonObject.bat * 1142 / 5070, 10);
		data = JSON.stringify(myJsonObject);
		if (isEncrypt){
			cell=encrypt(data);
		} else{
			cell=data;
		}
	}
	catch (ex)
	{
		console.warn(ex);
	}
});

const encrypt = (text) => {
	try {
    return CryptoJS.AES.encrypt(text, key).toString();
	} catch (ex) {
			console.log(ex);
	}
}

function insertBat(data){
	// data is a javascript object   
	var statement = db.prepare("INSERT INTO battery_records VALUES (?, ?)");
	// Insert values into prepared statement
	statement.run(data.battery_record[0].unix_time, data.battery_record[0].celsius);
	// Execute the statement
	statement.finalize();
}

function readBat(callback){
	fs.readFile('/sys/bus/w1/devices/28-00000400a88a/w1_slave', function(err, buffer)
 {
		 if (err){
				console.error(err);
				process.exit(1);
		 }

		 // Read data from file (using fast node ASCII encoding).
		 var data = buffer.toString('ascii').split(" "); // Split by space

		 // Extract battery from string and divide by 1000 to give celsius
		 var bat  = parseFloat(data[data.length-1].split("=")[1])/1000.0;

		 // Round to one decimal place
		 bat = Math.round(bat * 10) / 10;

		 // Add date/time to battery
		var data = {
					 battery_record:[{
					 unix_time: Date.now(),
					 charge: bat
					 }]};

		 // Execute call back with data
		 callback(data);
	});
};

function logBat(interval){
	// Call the readBat function with the insertBat function as output to get initial reading
	readBat(insertBat);
	// Set the repeat interval (milliseconds). Third argument is passed as callback function to first (i.e. readTemp(insertTemp)).
	setInterval(readBat, interval, insertBat);
};

function selectBat(num_records, start_date, callback){
	// - Num records is an SQL filter from latest record back trough time series, 
	// - start_date is the first date in the time-series required, 
	// - callback is the output function
	var current_bat = db.all("SELECT * FROM (SELECT * FROM battery_records WHERE unix_time > (strftime('%s',?)*1000) ORDER BY unix_time DESC LIMIT ?) ORDER BY unix_time;", start_date, num_records,
		 function(err, rows){
				if (err){
				response.writeHead(500, { "Content-type": "text/html" });
				response.end(err + "\n");
				console.log('Error serving querying database. ' + err);
				return;
						 }
				data = {battery_record:[rows]}
				callback(data);
	});
};

// Start battery logging (every 5 min).
var msecs = (60 * 5) * 1000; // log interval duration in milliseconds
logBat(msecs);
// Send a message to console
console.log('Server is logging to database at '+msecs+'ms intervals');