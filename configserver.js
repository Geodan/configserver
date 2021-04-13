const port = 3002;

const express = require('express');
const logger = require('morgan');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const uuidv4 = require('uuid/v4');
const md5 = require('md5')
const sanitize = require("sanitize-filename");
const config = require('./config.json');

const app = express();

app.set('trust proxy', config.trustproxy);
app.use(logger('dev'));
app.use(cors());
app.use(fileUpload({limits: { fileSize: 10 * 1024 * 1024 }}));
app.use('/', express.static(__dirname + '/public'));
app.use(express.urlencoded({extended: true}));

function validateConfig(json) {
    return (json.map && json.datacatalog && json.tools && json.keys)
}

app.post('/', async (req, res, next) => {
    if (Object.keys(req.files).length == 0) {
      return res.status(400).send('No files were uploaded.');
    }
    let key = req.body.key;
    let hash = md5(key).slice(0,12)
    //console.log(`key: ${key}, hash: ${hash}`)

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let configFile = req.files.configfile;
    if (configFile.truncated) {
        return res.status(413).json({error: 'max file size exceeded'});
    }
    try {
        const json = JSON.parse(configFile.data);
        if (!validateConfig(json)) {
            return res.status(422).json({"error": 'Invalid config file'})
        }
    } catch (error) {
        return res.status(422).json({"error": `Error parsing json: ${error}`})
    }
    let hashedDirname =`${__dirname}/public/files/${hash}`;
    fs.mkdirSync(hashedDirname, {recursive: true});


    // Use the mv() method to place the file somewhere on your server
    let storageFilename = req.body.filename;
    let filename;
    if (storageFilename && storageFilename !== '') {
        filename = sanitize(storageFilename);
    } else {
        //filename = `${uuidv4()}.json`;
        filename = sanitize(req.files.configfile.name)
    }
    configFile.mv(`${hashedDirname}/${filename}`, function(err) {
    if (err) {
        return res.status(500).json({error: err});
    }
    const url = `${req.protocol}://${req.hostname}${`${config.pathprefix}${req.originalUrl}/files/${hash}/${filename}`.replace(/\/\//g, '/')}`;
    res.json({"file": filename, "url": url, "use": config.template.replace('{url}', url)});
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
