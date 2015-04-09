'use strict'

module.exports = createRequireImpl

var requireLocalFile = require('./require-local-file.js')
var makeTrackable    = require('./make-trackable.js')
var Visitor          = require('./visitor.js')
var path             = require('path')

function createRequireImpl(filename, visitor, cfg) {
  return cfg.makeFunction(RequireImpl)

  function RequireImpl(cfg, ctxt, args, isNew) {
    var target = args[0]
    if (!target) {
      return cfg._valueStack.push(cfg.makeUnknown())
    }

    if (!target.isString() || !target._value) {
      return cfg._valueStack.push(cfg.makeUnknown())
    }
    var val = target._value

    if (!/^(\w:\\|\\|\/|\.)/.test(val)) {
      return cfg._valueStack.push(
        makeTrackable(cfg, val, visitor.reportUsage)
      )
    }

    return requireLocalFile(val, filename, cfg, visitor, onrequired)
  }

  function onrequired(err, value) {
    if (err || !value) {
      return Visitor.current.cfg._valueStack.push(Visitor.current.cfg.makeUnknown())
    }
    Visitor.current.cfg._valueStack.push(value)
    Visitor.current.advance()
  }
}

