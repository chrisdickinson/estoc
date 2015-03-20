const createUsageStream = require('./index.js')

var stream    = require('stream')
var Transform = stream.Transform

var txf = new Transform({
  objectMode: true,
  transform: function(usage, _, ready) {
    ready(null, new Buffer(String(usage.info() || '') + '\n'))
  }
})

createUsageStream(process.argv[2]).pipe(txf).pipe(process.stdout)
