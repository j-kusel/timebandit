const express = require('express');
const morgan = require('morgan');

module.exports = () => {
    const app = express();
    app.use(morgan('dev'));
    return app;
};
