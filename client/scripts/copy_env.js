// USAGE: in this folder, run "NODE_ENV=deployment node copy_env"

const config = require('../config/sysadmin');
const fs = require('fs');
const path = require('path');
const client = require('scp2');

const file = '../config/env/deployment.js';
const env_path = path.join(path.dirname(fs.realpathSync(__filename)), file);
console.log(env_path);

client.scp(
    env_path, {
        host: config.host,
        username: config.username,
        password: config.password,
        path: path.join(config.path, 'config/env/deployment.js')
    }, err => console.log(err)
);

