const configExpress = require('./config/express');
const app = configExpress();
const config = require('./config/config');
var axios = require('axios');

require('./routes/download')(app);

var server = app.listen(config.port);
