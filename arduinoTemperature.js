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