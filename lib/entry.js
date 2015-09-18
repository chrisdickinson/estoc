'use strict'

const estoc = require('./estoc.js')
const fs = require('fs')

if (require.main === module) {
  main(process.argv.slice(2))
}

function main (argv) {
  if (!argv[0]) {
    return console.log('pass a path to the command, geez')
  }

  const maybeTarball = /\.(tar.gz|tar|tgz|t.z)$/.test(argv[0])

  return (maybeTarball ?
    estoc.createTarballStream :
    estoc.createFileStream)(argv[0])
      .on('data', ondata)

  function ondata (info) {
    console.log(
      prettyPosition(info.accessChain[info.accessChain.length - 1]) + ' ' +
      info.accessChain[info.accessChain.length - 1].manner + ' ' +
      info.accessChain.map(xs => xs.name).join('.')
    )
  }
}

function prettyPosition (acc) {
  return [
    acc.filename,
    acc.position.start.line,
    acc.position.start.column
  ].join(':')
}
