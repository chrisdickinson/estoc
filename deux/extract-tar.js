'use strict'

module.exports = extract

const concat = require('concat-stream')
const tarFiles = require('tar-files')
const mime = require('mime')
const path = require('path')
const fs = require('fs')

class FSResolver {
  constructor (mapping, packageJSONPath) {
    this._mapping = mapping
    this._packageJSONPath = packageJSONPath
  }
  readFile (filename, enc, ready) {
    if (arguments.length === 2) {
      ready = enc
      enc = null
    }
    filename = filename.slice(1)
    var buf = this._mapping.get(filename)
    if (!buf) {
      return ready(new Error('no such file: ' + filename))
    }
    buf = enc ? buf.toString(enc) : buf
    return ready(null, buf)
  }
  isFile (filename, ready) {
    return ready(null, this._mapping.has(filename.slice(1)))
  }
  getNames () {
    var buf = this._mapping.get(this._packageJSONPath)
    if (!buf) {
      throw new Error('no package.json found')
    }
    var json = JSON.parse(buf.toString('utf8'))
    var main = json.main || './index.js'
    var dir = '/' + this._packageJSONPath.split('/')[0]
    var out = [path.join(dir, main), path.join(dir, json.name + '.js')]
    if (json.bin) {
      if (typeof json.bin === 'string') {
        json.bin = {keyDoesntMatter: json.bin}
      }
      for (var key in json.bin) {
        var candidate = path.join(dir, json.bin[key])
        if ((this._mapping.get(candidate.slice(1)) || [])[0] === 35) {
          if (/(node|iojs)\s*$/.test(
            this._mapping.get(candidate.slice(1)).toString('utf8').split('\n')[0]
          )) {
            out.push(candidate)
          }
        }
      }
    }
    return out.filter(xs => this._mapping.has(xs.slice(1)))
  }
}

function extract (filename, ready) {
  var output = new Map()
  var packageJSON = null
  tarFiles(filename, function (stream, ready) {
    if (stream.path.split('/').length === 2 &&
        /.*\/package.json$/.test(stream.path)) {
      packageJSON = stream.path
    }

    // omit anything bigger than 16kb
    if (stream.size > 16384) {
      return ready()
    }

    // skip bundled deps
    if (/node_modules/.test(stream.path)) {
      return ready()
    }

    if (!/^(text|application)/.test(mime.lookup(stream.path))) {
      return ready()
    }

    stream.pipe(concat(function (buf) {
      output.set(stream.path, buf)
    }))
  }, function (err) {
    if (err) {
      return ready(err)
    }
    return ready(null, new FSResolver(output, packageJSON))
  })
}
