var FSPackage = require('./lib/fs-package.js')
var path = require('path')

var cache = new Map
var pkg = new FSPackage(path.join(path.resolve(process.argv[2]), 'package.json'))

var inspect = require('./index.js')

pkg.getEntryPoints(function(err, entryPoints) {
  console.log(entryPoints)
  var queue = []
  iter()

  function iter() {
    if(!entryPoints.length) return iterQueue()
    
    var entry = entryPoints.shift()
    pkg.getASTFor(entry, function(err, ast) {
      if (err) throw err
      inspect(null, cache, entry, pkg, ast, queue, function(err, value) {
        iter()
      })
    })
  }

  function iterQueue() {
    if (!queue.length) {
      return
    }
    var next = queue.shift()
    next(iterQueue)
  }
})

if(false)
pkg.getASTFor('/test.js', function(err, ast) {
  inspect(null, cache, '/test.js', pkg, ast, function(err, value) {
    
  })
})
