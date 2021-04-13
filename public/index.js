function byteString(byteCount, precision) {
    let factor = precision ? Math.pow(10,precision) : 1;
    let outputByteCount = byteCount;
    if (outputByteCount > (1024 * 1024 * 1024)) {
        outputByteCount = Math.round(factor * outputByteCount/(1024*1024*1024))/factor;
        outputUnit = 'GByte';
    } else if (outputByteCount > (1024 * 1024)) {
        outputByteCount = Math.round(factor * outputByteCount/(1024*1024))/factor;
        outputUnit = 'MByte';
    } else if (outputByteCount > 1024) {
        outputByteCount = Math.round(outputByteCount/1024);
        outputUnit = 'kByte';
    } else {
        outputByteCount = Math.round(outputByteCount);
        outputUnit = 'Byte';
    }
    return `${outputByteCount} ${outputUnit}`;
}

function storeKey(key) {
    if (!key || key === '') {
        return;
    }
    let oldKeys = retrieveKeys();
    oldKeys = oldKeys.filter(oldKey=>oldKey !== key);
    while (oldKeys.length > 10) {
        oldKeys.shift();
    }
    oldKeys.push(key);
    window.localStorage.setItem('keys', JSON.stringify(oldKeys));
}
function deleteAllKeys() {
    window.localStorage.setItem('keys', JSON.stringify([]));
    updateKeyHistory();
}
function retrieveKeys() {
    let value = window.localStorage.getItem('keys');
    if (!value) {
        return [];
    }
    try {
        return JSON.parse(value);
    } catch (err) {
        return [];
    }
}

function fileLine(key, fileItem) {
    return `<tr><td><a href="${fileItem.use}" target=_blank>preview</a></td><td><a href="#" onclick="deleteFile('${key}','${fileItem.name}')">delete</a></td><td>${fileItem.permissions}</td><td>${byteString(fileItem.size,1)}</td><td><a href="${fileItem.url}" download target=_blank>${fileItem.name}</a></td></tr>\n`
}

async function deleteFile(key, filename) {
    let listoutput = document.querySelector('#listoutput');
    try {
        let response = await fetch('deletefile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: `key=${encodeURIComponent(key)}&filename=${encodeURIComponent(filename)}`
        });
        if (response.ok) {
            let result = await response.json();
            listFiles(key);
        } else {
            // error
            listoutput.innerHTML = response.statusText;
        }
    } catch(err) {
        listoutput.innerHTML = err.message;
    }
}

async function listFiles(key) {
    let listoutput = document.querySelector('#listoutput');
    if (!key) {
        listoutput.innerHTML = "";
        return;
    }
    try{
        let response = await fetch('list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: `key=${encodeURIComponent(key)}`
        });
        if (response.ok) {
            let result = await response.json();
            listoutput.innerHTML = `<table>${result.map(file=>fileLine(key, file)).join('\n')}</table>`
            console.log(result);
        } else {
            // error
            listoutput.innerHTML = response.statusText;
        }
    } catch (err) {
        listoutput.innerHTML = err.message;
    }
}

function updateKeyHistory() {
    let prevKeys = retrieveKeys();
    if (!Array.isArray(prevKeys)) {
        deleteAllKeys();
        prevKeys = [];
    }
    let oldKeysDiv = document.querySelector("#oldkeys");
    oldKeysDiv.innerHTML = ''
    if (prevKeys.length) {
        let activeKey = prevKeys[prevKeys.length - 1];
        document.querySelector('input[name="key"]').value = activeKey;
        if (prevKeys.length > 1) {
            oldKeysDiv.innerHTML = `<select name="oldkeys">
                ${prevKeys.reverse().map((key,idx)=>`<option value="${key}" ${idx==0?'selected':''}>${key}</option>`).join('\n')}
                </select>`
        }
        oldKeysDiv.innerHTML += `<input type="button" name="delkeys" value="clear keys">`;
    } else {
        document.querySelector('input[name="key"]').value = '';
    }
}

function keyChanged() {
    let newKey = document.querySelector('select[name="oldkeys"]').value;
    document.querySelector('input[name="key"]').value = newKey;
    listFiles(newKey);
}

async function uploadFile(key) {
    let listoutput = document.querySelector('#listoutput');
    const files = document.querySelector('input[name="configfile"]').files;
    const filename = document.querySelector('input[name="filename"]').value;
    if (!files.length || !key || key === '') {
        return;
    }
    listoutput.innerHTML = 'uploading...'
    const formData = new FormData();
    formData.append('configfile', files[0]);
    formData.append('key', key);
    formData.append('filename', filename);
    try {
        let response = await fetch('.', {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            let json = await response.json();
            listoutput.innerHTML = 'Upload ready';
            setTimeout(()=>listFiles(key), 1500);
        } else {
            listoutput.innerHTML = response.statusText;
        }
    } catch (err) {
        listoutput.innerHTML = err.message;
    }
}

window.addEventListener('load', ()=>{
    if (location.protocol !== 'https:' && location.port === '' && location.hostname !== 'localhost') {
        location.replace(`https:${location.href.substring(location.protocol.length)}`);
    }
    updateKeyHistory();
    listFiles(document.querySelector('input[name="key"]').value);
    let listButton = document.querySelector("#listbutton");
    listButton.addEventListener('click', (e)=>{
        let key = document.querySelector('input[name="key"]').value;
        if (!key || key === '') {
            window.alert('please specify your unique id');
        } else {
            storeKey(key);
            updateKeyHistory()
        }
        listFiles(key);
    })
    form = document.querySelector("form");
    form.addEventListener('submit', (event)=>{
        let key = document.querySelector('input[name="key"]').value;
        if (!key) {
            window.alert('please specify your unique id');
            event.preventDefault();
            return;
        }
        storeKey(key);
        updateKeyHistory();
        uploadFile(key);
        event.preventDefault();
    });
    document.addEventListener('click', e=>{
        if (e.target && e.target.tagName === 'INPUT' && e.target.name === 'delkeys') {
            deleteAllKeys();
            listFiles();
        }
    });
    document.addEventListener('change', e=>{
        if (e.target && e.target.tagName === 'SELECT' && e.target.name === 'oldkeys' ) {
            keyChanged();
        }
    })
})