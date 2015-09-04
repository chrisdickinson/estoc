'use strict'

module.exports = handleInternalModule

const wrapper = require('module').wrapper
const esprima = require('esprima')
const resolve = require('resolve')
const path = require('path')

const Module = require('./module.js')

function handleInternalModule (visitor, sourceModule, targetName, ready) {
  var targetFilename = null

  return resolve(targetName, {
    basedir: path.dirname(sourceModule.filename),
    isFile: visitor.fs.isFile,
    readFile: visitor.fs.readFile
  }, onfilename)

  function onfilename (err, targetFilename_) {
    if (err) {
      return ready(err)
    }

    targetFilename = targetFilename_
    if (visitor.moduleCache.has(targetFilename)) {
      return ready(null, visitor.moduleCache.get(targetFilename), true)
    }

    return visitor.fs.readFile(targetFilename, 'utf8', onfile)
  }

  function onfile (err, data) {
    if (err) {
      return ready(err)
    }

    if (data.slice(0, 2) === '#!') {
      data = data.split('\n').slice(1).join('\n')
    }
    try {
      var ast = esprima.parse(
        wrapper.join(data),
        {loc: true}
      )
    } catch (err) {
      // XXX: log error
      return ready(err)
    }

    const module = new Module(
      targetFilename,
      ast,
      visitor.cfg.makeObject()
    )
    visitor.moduleCache.set(module.filename, module)
    module.execute(visitor)
    return ready(null, module)
  }
}
