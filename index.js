"use strict"

module.exports = createUsageStream

const visitPackage   = require('./lib/visit-package.js')
const loadTARPackage = require('./lib/tar-package.js')
const loadFSPackage  = require('./lib/fs-package.js')
const Readable       = require('stream').Readable
const path           = require('path')
const fs             = require('fs')

function createUsageStream(filename, opts, ready) {
  const stream = Readable({objectMode: true, read: noop})
  switch (arguments.length) {
    case 2:
      ready = opts
    case 1:
      opts = {}
      ready = typeof ready === 'function' ? ready : noop
  }
  fs.stat(filename, onstat)
  return stream

  function onstat(err, stat) {
    if (err) {
      return stream.emit('error', err), ready(err)
    }
    var loadPackage = stat.isDirectory() ?
      loadFSPackage :
      loadTARPackage
    loadPackage(filename, onpkg)
  }

  function onpkg(err, pkg) {
    if (err) {
      return stream.emit('error', err), ready(err)
    }
    visitPackage(pkg, stream, opts, ready)
  }
}

function noop(n) {
}
