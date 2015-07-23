module.exports = defineRuntime

const makeTrackable = require('./make-trackable.js')

function defineRuntime(cfg, trackUsage) {
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
    global.newprop(globalName).assign(makeTrackable(cfg, globalName, trackUsage))
  })
}
