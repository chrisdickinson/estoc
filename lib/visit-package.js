'use strict'

module.exports = visitPackage

var visitModule = require('./visit-module.js')
var Visitor     = require('./visitor.js')
var path        = require('path')

function visitPackage(pkg, stream, opts, ready) {
  var visitor = new Visitor(opts || {}, stream, pkg, pkg.name, null)

  return pkg.getEntryPoints(onentrypoints)

  function onentrypoints(err, entryPoints) {
    if (err) {
      return ready(err)
    }
    return iterateEntryPoints(null)

    function iterateEntryPoints(err) {
      if (err) {
        return ready(err)
      }

      if (!entryPoints.length) {
        return iterateQueue()
      }

      var file = entryPoints.shift()
      pkg.getASTFor(file, function onast(err, ast) {
        if (err) {
          return ready(err)
        }

        var child = visitor.beget(file)
        child.activate()
        visitModule(file, ast, child, null, iterateEntryPoints)
      })
    }
  }

  function iterateQueue(err) {
    if (err) {
      return ready(err)
    }
    var next = visitor.popFunction()
    if (!next) {
      return finish()
    }
    next(iterateQueue)
  }

  function finish() {
    stream.once('end', ready)
    stream.push(null)
  }
}

