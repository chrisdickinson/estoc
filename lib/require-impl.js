'use strict'

module.exports = RequireImpl

const handleExternalModule = require('./handle-external-module.js')
const handleInternalModule = require('./handle-internal-module.js')

function RequireImpl (visitor, module, cfg, ctxt, args, isNew) {
  var target = args[0]

  if (!target) {
    return cfg._valueStack.push(cfg.makeUnknown())
  }

  if (target.isEither()) {
    // we should return an Either<> of the result
    // of calling RequireImpl with each outcome.
    var outcomes = target.outcomes()
    var results = []
    return enumerateRequireOutcomes(outcomes, this, visitor, module, results)
  }

  if (!target.isString() || !target._value) {
    return cfg._valueStack.push(cfg.makeUnknown())
  }

  if (!/^(\w:\\|\\|\/|\.)/.test(target._value)) {
    return handleExternalModule(visitor, module, target._value)
  }

  visitor.paused = true
  var sync = true
  handleInternalModule(visitor, module, target._value, onInternal)
  sync = false
  return

  function onInternal (err, module, fromCache) {
    if (err) {
      cfg._valueStack.push(cfg.makeUnknown())
    } else if (fromCache) {
      cfg._valueStack.push(module.exports)
    }
    visitor.paused = false
    if (!sync) {
      visitor.onresume()
    }
  }
}

function enumerateRequireOutcomes (outcomeIter, fnObj, visitor, module, results) {
  var next = outcomeIter.next()
  if (next.done) {
    return visitor.cfg._valueStack.push(
      visitor.cfg.makeEither(results)
    )
  }

  visitor.cfg.insertFrame(function () {
    results.push(visitor.cfg._valueStack.pop())
    enumerateRequireOutcomes(outcomeIter, fnObj, visitor, module, results)
    return true
  })
  RequireImpl.call(fnObj, visitor, module, visitor.cfg, null, [next.value], false)
}
