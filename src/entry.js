'use strict'

const extractFiles = require('./extract-tar.js')
const Visitor = require('./visitor.js')
const fs = require('fs')

if (require.main === module) {
  main(process.argv.slice(2))
}

function main (argv) {
  if (!argv[0]) {
    return console.log('pass a path to the command, geez')
  }

  process.stderr.write('\r' + argv[0])

  if (/\.(tar.gz|tar|tgz|t.z)$/.test(argv[0])) {
    return extractFiles(argv[0], function (err, resolveFS) {
      if (err) {
        console.log(argv[0])
        throw err
      }
      const visitor = new Visitor(resolveFS)
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
    })
  } 
  
  if (fs.statSync(argv[0]).isDirectory()) {
    return
  }

  const visitor = new Visitor()
  return visitor.run(argv[0], oncomplete)

  function oncomplete (err) {
    if (err) {
      console.trace(err, err.stack)
    }
  }
}
