'use strict'

const Visitor = require('./visitor.js')

if (require.main === module) {
  main(process.argv.slice(2))
}

function main (argv) {
  const visitor = new Visitor()

  if (!argv[0]) {
    return console.log('pass a path to the command, geez')
  }

  visitor.run(argv[0], function (err) {
    if (err) {
      console.log(err.stack)
    }
  })
}
