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
        data.candidates.forEach(time => {
            let newtime = {
                time: time + Date.now(),
                bit: (1 << data.target),
            };
            let newstack = stack.filter((oldtime, ind) => {
                if (oldtime.time < Date.now()) {
                    return false;
                }
                if (newtime.time - oldtime.time < 5) {
                    clearTimeout(oldtime.timeout);
                    newtime.bit |= oldtime.bit;
                    return false;
                }
                return true;
            });
            newtime.timeout = setTimeout(() => {
                console.log(newtime.bit);
            }, time);
            newstack.push(newtime);
            stack = newstack;
        });
        /*
        data.candidates.forEach(time => {
            // THESE TIMES AREN'T RIGHT
            let dupls = [];
            let update = {
                time: Date.now() + time,
                bit: (1 << data.target),
            };
            //console.log('original', update.bit);
            Object.keys(stack).forEach(key => {
                let gap = stack[key].time - update.time;
                //console.log(stack[key].time, update.time, gap);
                if (Math.abs(gap) < SCHEDULING_THRESHOLD) {
                    // this pairs it with other instruments if necessary
                    update.bit |= stack[key].bit;
                    // prepare duplicate for deletion
                    clearTimeout(stack[key].timeout);
                    delete stack[key];
                }
            });
            //console.log('updated', update.bit);
            
            let id = uuid();
            var cb = setTimeout(() => {
                // SEND TO ATMEGA HERE
                //console.log(update.bit);
                delete stack[id];
            }, time);
            stack[id] = { ...update, timeout: cb };
            //console.log(Object.keys(stack).length);
        });
        */
    });
});

