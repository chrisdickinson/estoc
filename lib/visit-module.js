'use strict'

module.exports = visitModule

const createRequireImpl = require('./create-require-impl.js')
const makeTrackable     = require('./make-trackable.js')
const Usage             = require('./usage.js')
const once              = require('once')
const path              = require('path')

function visitModule(filename, ast, visitor, exports, ready) {
  var cfg = visitor.getCFG(ast, {
    onfunction: onfunction,
    onload: onload,
    oncall: oncall
  })
  visitor.setAdvance(advanceCFG)
  ready = once(ready)

  var requireImpl = createRequireImpl(filename, visitor, cfg)
  var moduleObj   = cfg.makeObject()
  var exportsObj  = exports || cfg.makeObject()
  var filenameVal = cfg.makeValue('string', filename)
  var dirnameVal  = cfg.makeValue('string', path.dirname(filename))

  moduleObj.newprop('exports').assign(exportsObj)

  // when we visit a module, we create a function wrapper for it
  // that we collect the definition of, after which we call it with
  // our injected values. this means that "onfunction" has two states:
  // initial pickup of the moduleWrapper, and subsequent collection
  // of unexecuted functions.
  var currentOnFunction  = onfunction_getModuleWrapper
  var moduleWrapper      = null
  var collectedFunctions = null

  try {
    while(cfg.advance());
  } catch(err) {
    return ready(err)
  }

  if (!moduleWrapper) {
    return ready(new Error('could not find module wrapper!'))
  }

  moduleWrapper.call(cfg, cfg.global(), [
    exportsObj,
    requireImpl,
    moduleObj,
    filenameVal,
    dirnameVal
  ])

  return advanceCFG()

  // ----- cfg builder advancement ------------------------------------

  function advanceCFG() {
    try {
      _advanceCFG()
    } catch(err) {
      return ready(err)
    }
  }

  function _advanceCFG() {
    var count = 0
    while (1) {
      if (visitor.isPaused()) {
        return
      }
      if (!cfg.advance()) {
        break
      }
      if (++count === visitor.maxIterations) {
        return setImmediate(advanceCFG)
      }
    }
    completeCFG()
  }

  function completeCFG() {
    // discard cfg edges for memory purposes
    cfg._edges.length = 0

    if (collectedFunctions) {
      visitor.pushFunction(visitUnexecuted)
    }
    ready(null, moduleObj.getprop('exports').value())
  }

  function visitUnexecuted(cb) {
    ready = once(cb)
    visitor.activate()
    setImmediate(iterateUnexecuted)
  }

  function iterateUnexecuted() {
    if (!collectedFunctions) {
      return ready(null)
    }
    var nextNode = Queue.nextUncalled(collectedFunctions)
    if (!nextNode) {
      collectedFunctions = null
      return ready(null)
    }

    var nextFn = nextNode.fn
    var sfi    = nextFn.sharedFunctionInfo()
    var arity  = sfi.arity()
    var args   = new Array(arity)
    var marks  = nextFn.getMark('ioc')
    collectedFunctions = nextNode.next
    if (marks.length) for (var i = 0; i < arity; ++i) {
      args[i] = makeTrackable(
        cfg,
        marks[0].concat(Usage.makeIOCSegment(i)),
        visitor.reportUsage
      )
    } else for(var i = 0; i < arity; ++i) {
      args[i] = cfg.makeUnknown()
    }

    nextFn.call(cfg, cfg.makeUnknown(), args)
    advanceCFG()
  }

  // ----- cfg builder callbacks --------------------------------------

  function onfunction(fn, astNode) {
    fn.filename = filename
    currentOnFunction(fn, astNode)
  }

  function onfunction_getModuleWrapper(fn, astNode) {
    currentOnFunction = onfunction_collectFunctions
    moduleWrapper = fn
  }

  function onfunction_collectFunctions(fn, astNode) {
    var frame = cfg._callStack.current()
    if (frame) {
      fn.filename = frame._func.filename
    }
    collectedFunctions = new Queue(collectedFunctions, fn)
  }

  function oncall(fn, context, args, recursion) {
    var sfi = null
    if (fn.sharedFunctionInfo && (sfi = fn.sharedFunctionInfo())) {
      return sfi.callCount() < visitor.maxCalls
    }
  }

  function onload(name, value, node) {
    var trackedName = value.getMark('tracked-name')
    if (trackedName.join('')) {
      // ok then.
      var names = yieldArrays(trackedName)
      var seen = new Set
      for (var i = 0; i < names.length; ++i) {
        if (seen.has(names[i].join('.'))) {
          continue
        }
        seen.add(names[i].join('.'))
        var incoming = names[i].slice()
        if (name.getName()) {
          incoming[0] = Usage.makeLoadSegment(
            incoming[0],
            name.getName()
          )
        }
        visitor.reportUsage(new Usage(Usage.LOAD, cfg, incoming))
      }
    }
  }
}

// Array<Array...Array<String>> -> Array<Array<String>>
function yieldArrays(root, out) {
  out = out || []
  if (typeof root[0] === 'string') {
    out.push(root)
  } else for (var i = 0; i < root.length; ++i) {
    if (Array.isArray(root[i])) {
      yieldArrays(root[i], out)
    }
  }
  return out
}

function Queue(next, fn) {
  this.next = next
  this.fn = fn
}

Queue.nextUncalled = function(q) {
  while(q && q.fn.sharedFunctionInfo().callCount()) {
    q = q.next
  }
  return q
}
