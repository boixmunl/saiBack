"use strict";

var express = require('express');
var http = require('http');
var app = express();
var arduinoSerialPort = '/dev/ttyUSB0';	//Serial port over USB connection between the Raspberry Pi and the Arduino
app.get('/users', (req, res) => {
	res.send(cell)
  });

app.get('/', (req, res) => {
	res.status(200).send("Welcome to API REST")
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

//var querystring = require('querystring');
parser.on('data', function (data)
{//When a new line of text is received from Arduino over USB
	try
	{
		/* var j = JSON.parser(data);
		dataS = data;
		bat = j.bat / 100.0;
		temp = j.temp / 100.0;
		hum = j.hum / 100.0;
		lat = j.lat / 100.0;
		long = j.long / 100.0;
		alt = j.alt / 100.0;
		raw = j.raw / 100.0;
		rzero = j.rzero / 100.0;
		ppm = j.ppm / 100.0;*/
		var myJsonObject = JSON.parse(data); //change to obj
		myJsonObject.dateLastInfo = new Date(); //add something
		data = JSON.stringify(myJsonObject);
		//writeFile('{"bat":"' + bat + '","temp":"' + temp + '","hum":"' + hum + '","lat":"' + lat + '","long":"' + long + '","alt":"' + alt + '","raw":"' + raw + '","rzero":"' + rzero + '","ppm":"' + ppm + '"}');
		//postData(querystring.stringify(j));	//Forward the Arduino information to another Web server
		cell=data;
	}
	catch (ex)
	{
		console.warn(ex);
	}
});