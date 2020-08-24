const configExpress = require('./config/express');
const app = configExpress();
const config = require('./config/config');
const socketIo = require('socket.io');
const SerialPort = require('serialport');
const port = new SerialPort('/dev/ttyUSB0', { baudRate: 9600 });
const { uuid } = require('uuidv4');
var axios = require('axios');

const server = app.listen(config.port);
const io = socketIo(server, { origins: '*:*' });
var buffer = new Buffer.alloc(1);

var scheduled = 0b00000000;
var scheduler_flag = false;

const SCHEDULING_THRESHOLD = 5; // 5ms in either direction

var stack = [];

let commands = {
    // sets buzzer duration, with 10ms granularity
    sustain: (args) => 0b01000000 | Math.round(args[0]/10),
}

let counter = 0;
io.on('connection', (socket) => {
    let date = new Date();
    socket.emit('hello', 'connected');
    console.log(`host ${socket.client.conn.request.headers.host} connected at ${date}`);
    socket.on('disconnect', () => {
        console.log(`host ${socket.client.conn.request.headers.host} disconnected at ${new Date()}`);
    });

    socket.on('command', data => {
        // split into command and arguments list
        let parsed = data.split(' ');
        let [comm, args] = [parsed.shift(), parsed];
        console.log(comm, args);
        if (!(comm in commands)) {
            socket.emit('err', `unrecognized command: "${comm}"`);
            return
        }
        buffer[0] = 0;
        port.write(buffer);

        // signal incoming command with 0, wait for 1 response
        if (port.read() === 1) {
            buffer[0] = commands[comm](args);
            port.write(buffer);
        }
        // make this recursive?
    });

    socket.on('trigger', data => {
        console.log(data);
        buffer[0] = data;
        port.write(buffer);
    });
});

