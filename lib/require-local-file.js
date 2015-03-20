'use strict'

module.exports = requireLocalFile

var visitModule = require('./visit-module.js')
var debug = require('util').debuglog('deps')
var path = require('path')

function requireLocalFile(localFile, fromFile, cfg, visitor, ready_) {
  var lastActive = visitor.deactivate()
  return visitor.package().resolveFilename(fromFile, localFile, onresolved)

  function onresolved(err, targetFile) {
    if (err) {
      if (visitor.assumeDefined) {
        return ready(null, cfg.makeObject())
      }
      return ready(err)
    }

    var cachedResult = visitor.getCachedModuleExport(targetFile)
    if (cachedResult) {
      debug('%s -> %s (cached)', fromFile, targetFile)
      return ready(null, cachedResult)
    }

    if (path.extname(targetFile) === '.json') {
      debug('%s -> %s (json)', fromFile, targetFile)
      return ready(null, cfg.makeObject())
    }

    var child = null

    debug('%s -> %s', fromFile, targetFile)
    return visitor.package().getASTFor(targetFile, onast)

    function onast(err, ast) {
      if (err) {
        return ready(err)
      }

      var exports = cfg.makeObject()
      child = visitor.beget(targetFile)
      child.activate()
      visitor.setCachedModuleExport(targetFile, exports)
      visitModule(targetFile, ast, child, exports, ready)
    }

    function ready(err, data) {
      lastActive.activate()
      if (data) {
        visitor.setCachedModuleExport(targetFile, data)
      }
      debug('%s <- %s', fromFile, targetFile)
      ready_(err, data)
    }
  }
}

