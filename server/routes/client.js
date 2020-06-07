var axios = require('axios');
var config = require('../config/config');
var createCsvStringifier = require('csv-writer').createObjectCsvStringifier;


module.exports = (app) => {
    app.route('/download')
        .post((req, res) => {
        });
};

