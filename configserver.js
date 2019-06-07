const port = 3002;

const express = require('express');
const logger = require('morgan');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const uuidv4 = require('uuid/v4');

const app = express();

app.use(logger('dev'));
app.use(cors());
app.use(fileUpload());
app.use('/', express.static(__dirname + '/public'));

app.post('/', (req, res, next) => {
    if (Object.keys(req.files).length == 0) {
      return res.status(400).send('No files were uploaded.');
    }
    
    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let sampleFile = req.files.configfile;

    // Use the mv() method to place the file somewhere on your server
    const filename = `${uuidv4()}.json`
    sampleFile.mv(`${__dirname}/public/files/${filename}`, function(err) {
    if (err)
        return res.status(500).send(err);

    res.json({"file": filename, "url": `${req.protocol}://${req.host}${`${req.originalUrl}/files/${filename}`.replace(/\/\//g, '/')}`});
    const a = req;
    });
});

app.delete('/', express.json({type: '*/*'}), (req, res) => {
    fs.unlinkSync(`${__dirname}/public/files/${req.body.file}`);
    res.json({
        file: 'done'
    });
});


app.listen(port);
console.log(`upload server listening on port ${port}`)

module.exports = app;
