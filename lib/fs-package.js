module.exports = loadFSPackage

const Package = require('./package.js')
const once    = require('once')
const path    = require('path')
const fs      = require('fs')

function loadFSPackage(filepath, ready) {
  return fs.readFile(filepath, 'utf8', onread)

  function onread(err, data) {
    if (err) {
      return ready(err)
    }
    try {
      var pkg = new FSPackage(filepath, JSON.parse(data))
    } catch(err) {
      return ready(err)
    }
    return ready(null, pkg)
  }
}

function FSPackage(filepath, json) {
  Package.call(this, json.name, json.version, json)
  this._base = path.dirname(filepath)
}

var proto = FSPackage.prototype = Object.create(Package.prototype)

proto.constructor = FSPackage

proto.getFullFilename = function(from, to) {
  var filepath = Package.prototype.getFullFilename.call(this, from, to)
  return filepath.replace(this._base, '')
}

proto._isFile = function(filename, ready) {
  if (filename[0] === '/') {
    filename = filename.slice(1)
  }
  fs.stat(path.resolve(this._base, filename), function(err, stat) {
    if (err) return ready(err)
    ready(null, stat.isFile())
  })
}

proto._readFile = function(filename, ready) {
  var trace = new Error('read ' + filename).stack
  if (filename[0] === '/') {
    filename = filename.slice(1)
  }

  fs.readFile(path.resolve(this._base, filename), 'utf8', function(err, data) {
    if (err) {
      console.log(trace)
      return ready(err)
    }
    return ready(null, data)
  })
}
