const port = 3002;

const express = require('express');
const path = require('path');
const logger = require('morgan');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
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

function getHash(key) {
    return md5(key.trim()).slice(0,19);
}

function getConfigDir(key) {
    return `${__dirname}/public/files/${getHash(key)}`;
}

app.post('/deletefile', (req, res) => {
    let key = req.body.key;
    let filename = req.body.filename;
    if (!key || !filename) {
        res.json({error:"missing required parameter"});
        return;
    }
    let dirname = getConfigDir(key);
    let fullPath = path.join(dirname, filename);
    if (!fs.existsSync(fullPath)) {
        return res.json({error: 'File does not exist'})
    }
    try {
        fs.unlinkSync(fullPath);
        return res.json({result: 'ok'});
    } catch(err) {
        return res.json({error: err.message});
    }
})

app.post('/list', (req, res) => {
    let key = req.body.key;
    if (!key) {
        res.json({error:"missing required parameter"});
        return;
    }
    let dirname = getConfigDir(key);
    if (!fs.existsSync(dirname)) {
        return res.json([])
    }
    let hash = getHash(key);
    let files = fs.readdirSync(dirname);
    let host = req.get('x-forwarded-host');
    if (!host) {
        host = req.get('host');
    }
    files = files.map((file)=>{
        const url = `${req.protocol}://${host}${`${config.pathprefix}/files/${hash}/${file}`.replace(/\/\//g, '/')}`;
        let stat = fs.statSync(path.join(dirname, file));
        let result = {
          name: file,
          url: url,
          use: config.template.replace('{url}', url),
          size: stat.size,
          file: !!(stat.mode & 0o100000),
          dir: !!(stat.mode &  0o040000),
          ctime: stat.ctime,
          mtime: stat.mtime,
          atime: stat.atime,
          permissions: `${(stat.mode & 0o040000)?'d':(stat.mode & 0o100000)?'f':'-'}${stat.mode & 0o400?'r':'-'}${stat.mode & 0o200?'w':'-'}${stat.mode & 0o100?'x':'-'}${stat.mode & 0o40?'r':'-'}${stat.mode & 0o20?'w':'-'}${stat.mode&0o10?'x':'-'}${stat.mode&0o4?'r':'-'}${stat.mode&0o2?'w':'-'}${stat.mode&0o1?'x':'-'}`,
          nlink: stat.nlink,
          uid: stat.uid,
          gid: stat.gid
        }
        return result;
      });
    res.json(files);
})

app.post('/', async (req, res, next) => {
    if (!req.files) {
        return res.status(400).send('No files were uploaded.');  
    }
    if (Object.keys(req.files).length == 0) {
      return res.status(400).send('No files were uploaded.');
    }
    let key = req.body.key;
    let hash = md5(key.trim()).slice(0,19)
    
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
    let configDir = getConfigDir(key);
    fs.mkdirSync(configDir, {recursive: true});


    // Use the mv() method to place the file somewhere on your server
    let storageFilename = req.body.filename;
    let filename;
    if (storageFilename && storageFilename !== '') {
        filename = sanitize(storageFilename);
    } else {
        //filename = `${uuidv4()}.json`;
        filename = sanitize(req.files.configfile.name)
    }
    configFile.mv(`${configDir}/${filename}`, function(err) {
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
