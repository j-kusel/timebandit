var axios = require('axios');
var config = require('../config/config');
var createCsvStringifier = require('csv-writer').createObjectCsvStringifier;

module.exports = (app) => {
    app.route('/download')
        .post((req, res) => {
            var stringifier = createCsvStringifier({
                header: ['inst', 'start', 'end', 'beats', 'offset']
                    .map(h => ({ id: h, title: h }))
            });
            var body = stringifier.getHeaderString().concat(stringifier.stringifyRecords(req.body.score));
            res.header('Content-Type', 'text/csv');
            //res.header('Content-Disposition', 'attachment; filename=timebandit_score.csv');
            res.send({ score: body });
        });
};

