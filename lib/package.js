module.exports = Package

var wrapper = require('module').wrapper
var espree = require('espree')
var path = require('path')

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

proto._loadFile = function(filename, ready) {
  return ready(new Error('not implemented!'))
}
