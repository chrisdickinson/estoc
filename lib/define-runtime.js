module.exports = defineRuntime

var makeTrackable = require('./make-trackable.js')

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
    'console'
  ]

  globals.forEach(function(globalName) {
    global.newprop(globalName).assign(makeTrackable(cfg, globalName, trackUsage))
  })

  // XXX: todo, move these to escontrol's runtime
  var JSON = cfg.makeObject()
  global.newprop('JSON').assign(JSON)
  JSON.newprop('stringify').assign(cfg.makeFunction(function(cfg) {
    cfg._valueStack.push(cfg.makeValue('string'))
  }))
  JSON.newprop('parse').assign(cfg.makeFunction(function(cfg) {
    cfg._valueStack.push(cfg.makeObject())
  }))
  global.newprop('parseInt').assign(cfg.makeFunction(function(cfg) {
    cfg._valueStack.push(cfg.makeValue('number'))
  }))
  global.newprop('parseFloat').assign(cfg.makeFunction(function(cfg) {
    cfg._valueStack.push(cfg.makeValue('number'))
  }))
}
