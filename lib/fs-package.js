module.exports = FSPackage

var Package = require('./package.js')
var path = require('path')
var fs = require('fs')

function FSPackage(filepath) {
  var pkgJSON = JSON.parse(fs.readFileSync(filepath, 'utf8'))
  Package.call(this, pkgJSON.name, pkgJSON.version, pkgJSON)
  this._base = path.dirname(filepath)
}

var proto = FSPackage.prototype = Object.create(Package.prototype)

proto.resolveFilename = function(from, to, ready) {
  var filename = path.resolve(path.dirname(from), to)
  var attempt = [
    filename,
    filename + '.js',
    filename + '.json',
    filename + path.sep + 'index.js',
    filename + path.sep + 'index.json'
  ]
  var self = this
  iterate()

  function iterate() {
    if (!attempt.length) {
      return ready(new Error('no such file ' + filename))
    }
    var next = attempt.shift()
    fs.stat(path.join(self._base, next), function(err, stat) {
      if (err || !stat.isFile()) {
        return iterate()
      }
      return ready(null, next)
    })
  }
}


proto._loadFile = function(filename, ready) {
  // try "filename", "filename + .js", "filename/index.js", "filename.json"
  var attempt = [
    filename,
    filename + '.js',
    filename + '.json',
    filename + path.sep + 'index.js',
    filename + path.sep + 'index.json'
  ]
  var self = this
  iterate()

  function iterate() {
    if (!attempt.length) {
      return ready(new Error('no such file ' + filename))
    }

    fs.readFile(self._base + attempt.shift(), 'utf8', function(err, data) {
      if (err) {
        return iterate()
      }
      return ready(null, data)
    })
  }
}

proto.getEntryPoints = function(ready) {
  // bin -> "string"
  // bin -> {who: "string", cares: "string"}
  // main
  //   OR: index.js / packagename.js
  var files = []
  var base = this._base
  switch (typeof this._json.bin) {
    case 'object': if (this._json.bin) {
      files = files.concat(Object.keys(this._json.bin).map(function(key) {
        return this[key]
      }, this._json.bin))
    }
    break;
    case 'string':
      files.push(this._json.bin)
    break;
  }
  if (this._json.main) {
    files.push(this._json.main)
  } else {
    files.push('index')
    files.push(this.name)
  }

  var pending = files.length
  var out = []

  files.forEach(function(xs) {
    getFirst([
      xs,
      xs + '.js',
      xs + '.json',
      xs + path.sep + 'index.js',
      xs + path.sep + 'index.json'
    ], onFile)
  })

  function getFirst(arr, ready) {
    iter()

    function iter() {
      if (!arr.length) return ready(new Error('no such file'))
      var next = arr.shift()
      fs.stat(path.resolve(base, next), function(err, stat) {
        if (err) return iter()
        if (!stat.isFile()) return iter()
        ready(null, path.resolve(base, next).replace(base, ''))
      })
    }
  }

  function onFile(err, file) {
    if (!err) {
      out.push(file)
    }
    !--pending && ready(null, out)
  }
}
