module.exports = loadTarPackage

const concat  = require('concat-stream')
const Package = require('./package.js')
const tar     = require('tar-stream')
const path    = require('path')
const zlib    = require('zlib')
const fs      = require('fs')

function loadTarPackage(filepath, ready) {
  var raw = fs.createReadStream(filepath)
  var extract = tar.extract()
  var map = new Map

  raw
    .pipe(zlib.createUnzip())
    .pipe(extract)

  extract
    .on('entry', onentry)
    .on('finish', onend)

  function onentry(header, stream, ready) {
    var entry = {
      header: header,
      data: null,
      skipped: true
    }
    map.set('/' + header.name.split(/[\/\\]/).slice(1).join('/'), entry)
    if (header.size > 131072 && /^\.(js|json)$/.test(path.extname(header.name))) {
      stream.on('end', ready).resume()
      return
    }
    entry.skipped = false
    stream.pipe(concat(ondata))
    function ondata(data) {
      entry.data = data.toString('utf8')
      ready()
    }
  }

  function onend() {
    setImmediate(function() {
      return ready(null, new TARPackage(filepath, map))
    })
  }
}

function TARPackage(filepath, fsinfo) {
  var jsonInfo = JSON.parse(fsinfo.get('/package.json').data)
  Package.call(this, jsonInfo.name, jsonInfo.version, jsonInfo)
  this._filepath = filepath
  this._fs = fsinfo
}

var proto = TARPackage.prototype = Object.create(Package.prototype)

proto.constructor = TARPackage

proto._isFile = function(filename, ready) {
  filename = path.resolve('/', filename)
  var entry = this._fs.get(filename)
  var self = this
  if (!entry) {
    return setImmediate(function() {
      return ready(new Error('ENOENT: no such file ' + filename))
    })
  }

  if (entry.type === 'symlink' || entry.type === 'link') {
    return self._isFile(entry.linkname, ready)
  }

  setImmediate(function() {
    ready(null, entry.header.type === 'file')
  })
}

proto._readFile = function(filename, ready) {
  var entry = this._fs.get(filename)
  var self = this
  if (!entry) {
    return setImmediate(function() {
      return ready(new Error('ENOENT: no such file ' + filename))
    })
  }

  return setImmediate(function() {
    if (entry.type === 'symlink' || entry.type === 'link') {
      return self._readFile(entry.linkname, ready)
    }
    ready(null, entry.data)
  })
}
