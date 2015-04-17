module.exports = Package

const wrapper = require('module').wrapper
const espree  = require('espree')
const once    = require('once')
const path    = require('path')

function Package(name, version, pkgJSON) {
  this.name = name
  this.version = version
  this._json = pkgJSON
}

var proto = Package.prototype

proto.hasDependency = function(str) {
  return (
    (this._json.dependencies || {})[str] ||
    (this._json.devDependencies || {})[str] ||
    (this._json.optionalDependencies || {})[str] ||
    (this._json.peerDependencies || {})[str]
  )
}

proto.getFullFilename = function(from, to) {
  return path.resolve(path.dirname(from), to)
}

proto.getASTFor = function(filename, ready) {
  var self = this
  ready = once(ready)

  return self._loadFile(filename, function(err, data) {
    if (err) {
      return ready(err)
    }
    try {
      data = espree.parse(wrapper.join(data.replace(/^#.*$/gm, '')), {loc: true})
    } catch(err) {
      return ready(err)
    }
    return ready(null, data)
  })
}

proto.getEntryPoints = function(ready) {
  // bin -> "string"
  // bin -> {who: "string", cares: "string"}
  // main
  //   OR: index.js / packagename.js
  var self = this
  var files = []
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
    if (this.name) files.push(this.name)
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
      self._isFile(next, function(err, isFile) {
        if (err || !isFile) return iter()
        ready(null, self.getFullFilename('/package.json', next))
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


proto._loadFile = function(filename, ready) {
  // try "filename", "filename + .js", "filename/index.js", "filename.json"
  filename = filename.replace(/\/+/g, '/')
  var attempt = [
    filename,
    filename + '.js',
    filename + '.json',
    filename + path.sep + 'index.js',
    filename + path.sep + 'index.json'
  ]
  var self = this
  ready = once(ready)
  iterate()

  function iterate() {
    if (!attempt.length) {
      return ready(new Error('no such file ' + filename))
    }

    self._readFile(attempt.shift(), function(err, data) {
      if (err) {
        return iterate()
      }
      return ready(null, data)
    })
  }
}

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
  ready = once(ready)
  iterate()

  function iterate() {
    if (!attempt.length) {
      return ready(new Error('no such file ' + filename))
    }
    var next = attempt.shift()
    self._isFile(next, function(err, isFile) {
      if (err || !isFile) {
        return iterate()
      }
      return ready(null, next)
    })
  }
}

