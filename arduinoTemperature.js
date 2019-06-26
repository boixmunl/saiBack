"use strict";

var express = require('express');
const ngrok = require('ngrok');
var http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const token = '799864144:AAFYArmIUiBmZaUCqxaolRA5Taj3Gnnogds';
const bot = new TelegramBot(token, {polling: true});
var app = express();
var arduinoSerialPort = '/dev/ttyUSB0';	//Serial port over USB connection between the Raspberry Pi and the Arduino
var restUrl;
var sshUrl;

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
	// 'msg' is the received Message from Telegram
	// 'match' is the result of executing the regexp above on the text content
	// of the message
  
	const chatId = msg.chat.id;
	const resp = match[1]; // the captured "whatever"
  
	// send back the matched "whatever" to the chat
	bot.sendMessage(chatId, restUrl);
  });

//Connect ngrok to rest API
(async function () {
    restUrl = await ngrok.connect({
		proto : 'http',
		addr : 8001,
		authtoken : '22Ywb26viDtAwYjnouhBp_3CmqyRhsJ1tWC3qxzRbwq'
	});
    console.log("Ngrok connected [localhost:8001] at url: ["+restUrl+"]");
})();

//Connect ngrok to SSH
(async function () {
    sshUrl = await ngrok.connect({
		proto : 'http',
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

app.get('/', (req, res) => {
	res.status(200).send("Welcome to cell "+restUrl)
  })

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
		myJsonObject.id = restUrl;
		data = JSON.stringify(myJsonObject);
		cell=data;
	}
	catch (ex)
	{
		console.warn(ex);
	}
});