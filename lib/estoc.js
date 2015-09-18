'use strict'

module.exports = {
  createTarballStream: createTarballStream,
  createFileStream: createFileStream
}

const extractFiles = require('./extract-tar.js')
const Readable = require('stream').Readable
const Visitor = require('./visitor.js')

function createTarballStream (filename) {
  const stream = new Readable({objectMode: true})
  stream._read = _=>_

  extractFiles(filename, onfs)
  return stream

  function onfs (err, resolveFS) {
    if (err) {
      throw err
    }
    const visitor = new Visitor(stream, resolveFS)
    const entryPoints = resolveFS.getNames()
    return iter()

    function iter () {
      if (!entryPoints.length) {
        return oncomplete()
      }
      visitor.run(entryPoints.shift(), function (err) {
        if (err) {
          return oncomplete(err)
        }
        iter()
      })
    }
  }

  function oncomplete (err) {
    if (err) {
      return stream.emit('error', err)
    }
    stream.push(null)
  }
}

function createFileStream (filename, ready) {
  const stream = new Readable({objectMode: true})
  const visitor = new Visitor(stream)
  stream._read = _=>_
  visitor.run(filename, oncomplete)
  return stream

  function oncomplete (err) {
    if (err) {
      return stream.emit('error', err)
    }
    stream.push(null)
  }
}
