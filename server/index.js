const configExpress = require('./config/express');
const app = configExpress();
const config = require('./config/config');
const http = require('http');
const socketIo = require('socket.io');
var axios = require('axios');



//require('./routes/client')(app);

const server = app.listen(config.port);
const io = socketIo(server);

io.on('connection', (socket) => {
    socket.emit('hello', 'hello there');
    console.log('connected');
    socket.on('disconnect', () => {
        console.log('disconnected');
    });
    socket.on('frame', data => {
        console.log(data);
    });
    socket.on('loopback', data => {
        console.log(Date.now() - data)
    });
});

