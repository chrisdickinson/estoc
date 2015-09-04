'use strict'

module.exports = define

function define(cfg, createSpy) {
  var global = cfg.global()
  global.newprop('global').assign(global)

  var globals = [
    'Buffer',
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'setImmediate',
    'clearImmediate',
    'process',
    'root',
    'GLOBAL',
    'console'
  ]

  globals.forEach(function(globalName) {
    global.newprop(globalName).assign(createSpy(globalName))
  })
}
