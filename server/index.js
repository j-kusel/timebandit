const configExpress = require('./config/express');
const app = configExpress();
const config = require('./config/config');
const http = require('http');
const socketIo = require('socket.io');
const SerialPort = require('serialport');
const port = new SerialPort('/dev/ttyUSB0', { baudRate: 9600 });
const { uuid } = require('uuidv4');
var axios = require('axios');



//require('./routes/client')(app);

const server = app.listen(config.port);
const io = socketIo(server, { origins: '*:*' });
var buffer = new Buffer.alloc(1);

var scheduled = 0b00000000;
var scheduler_flag = false;

const SCHEDULING_THRESHOLD = 5; // 5ms in either direction

var stack = [];
//setInterval(() => console.log(stack), 250);

let counter = 0;
io.on('connection', (socket) => {
    socket.emit('hello', 'hello there');
    console.log('connected');
    socket.on('disconnect', () => {
        console.log('disconnected');
    });
    socket.on('frame', data => {
        console.log('frame');
        console.log(data);
    });
    socket.on('trigger', data => {
        console.log(data);
        buffer[0] = 0b00000001;
        port.write(buffer);
    });
    socket.on('loopback', data => {
        console.log('loopback');
        console.log(Date.now() - data)
    });
    socket.on('schedule', data => {
        console.log(data);
        //port.write(data);
    });
});

