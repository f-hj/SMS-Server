var SerialPort = require("serialport");

var port = new SerialPort("/dev/ttyS0", {
	baudRate: 115200,
	parser: SerialPort.parsers.raw
})

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

port.on('data', data => {
	rl.write(data)
})

rl.on('line', (input) => {
 	input = input.replace('\r', '').replace('\n', '')
 	port.write(input)
});