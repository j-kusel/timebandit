let hooks = [];
let history = [];

var hook = (cb) => hooks.push(cb);
var get = () => history;

var log = (msg) => {
    hooks.forEach(cb => cb(msg));
    history.push(msg + '\n');
    console.log(msg);
}

module.exports = {
    hook,
    get,
    log
}
