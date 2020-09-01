const express = require('express');
const app = express();
const port = 9602;

app.use(express.static('docs'));

app.listen(port, `Serving docs at http://docs.banditsound.com (port ${port})`);
