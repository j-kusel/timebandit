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
    sustain: (args) => {
        let sus = 0b01000000 | Math.round(args[0]/10);
        console.log(args[0]/10);
        console.log(sus);
        return sus;
    },
            
    LED: (args) => 0b00000001,
}

let state = 'idle';
let command = '';


let counter = 0;
io.on('connection', (socket) => {
    port.on('readable', () => {
        let data = port.read();
        console.log(data);
        if (state === 'idle') {
        } else if (state === 'command') {
            // '1' is the handshake
            //console.log(typeof(data.readInt8(0)));
            if (data.readInt8(0) === 1) {
                console.log('ready to send!');
                console.log(command);
                // send pending command
                if (command) {
                    buffer[0] = commands[command.comm](command.args);
                    port.write(buffer);
                // or cancel with another 0
                } else
                    port.write(0);
            } else {
                console.log('some kinda error');
            }
            state = 'idle';
        }
    });

    let date = new Date();
    socket.emit('hello', 'connected');
    console.log(`host ${socket.client.conn.request.headers.host} connected at ${date}`);
    socket.on('disconnect', () => {
        console.log(`host ${socket.client.conn.request.headers.host} disconnected at ${new Date()}`);
    });
    //port.read();

    socket.on('command', data => {
        console.log('command', data);
        // split into command and arguments list
        let parsed = data.split(' ');
        let [comm, args] = [parsed.shift(), parsed];
        if (!(comm in commands)) {
            socket.emit('err', `unrecognized command: "${comm}"`);
            return
        }
        command = { comm, args };
        state = 'command';
        buffer[0] = 0;
        port.write(buffer);
    });

    let counter = 0
    socket.on('trigger', data => {
        console.log(counter++, data);
        buffer[0] = data;
        port.write(buffer);
    });
});

