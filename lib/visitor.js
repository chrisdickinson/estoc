'use strict'

module.exports = exportVisitor()

const escontrol = require('escontrol')
const path = require('path')
const fs = require('fs')

const handleInternalModule = require('./handle-internal-module.js')
const UnexecutedList = require('./unexecuted-list.js')
const RequireImpl = require('./require-impl.js')
const defineRuntime = require('./runtime.js')
const Spy = require('./spy.js')

function defaultIsFile (file, ready) {
  fs.stat(file, function (err, stat) {
    if (err && err.code === 'ENOENT') return ready(null, false)
    if (err) return ready(err)
    return ready(null, stat.isFile())
  })
}

function exportVisitor() {
  return class Visitor {
    constructor (stream, userFS) {
      this.fs = userFS || {
        readFile: fs.readFile,
        isFile: defaultIsFile
      }
      this.fs.readFile = this.fs.readFile.bind(this.fs)
      this.fs.isFile = this.fs.isFile.bind(this.fs)
      this.stream = stream
      this.paused = false
      this.onresume = null
      this.moduleStack = []
      this.moduleCache = new Map()
      this.lastFunction = null
      this.unexecutedFunctions = new UnexecutedList()
      this.cfg = escontrol(createEmptyProgramAST(), {
        onfunction: (fn, ast) => {
          return onfunction(this, fn, ast)
        },
        onload: (name, value, node) => {
          return onload(this, name, value, node)
        },
        oncall: (fn, ctxt, args, recr) => {
          return oncall(this, fn, ctxt, args, recr)
        }
      })
      defineRuntime(this.cfg, name => this.createSpy(name))
    }

    currentFileName () {
      return this.moduleStack[this.moduleStack.length - 1].filename
    }

    run (filename, ready) {
      handleInternalModule(this, {
        filename: '/dne.js'
      }, filename, (err, module) => {
        if (err) {
          return ready(err)
        }
        if (module.complete) {
          return ready()
        }
        advance(this, ready)
      })
    }

    createSpy (name) {
      return Spy.createRoot(this, name)
    }

    report (spy, args) {
      var current = spy
      var acc = []
      while (current) {
        acc.unshift(current.access)
        current = current.parent
      }
      this.stream.push({
        accessChain: acc,
        args: args,
        handled: hasHandler(this.cfg)
      })
    }
  }
}

function hasHandler (cfg) {
  var result = false
  try {
    result = cfg.getExceptionDestination() !== null
  } finally {
    return result
  }
}

function advance (visitor, ready) {
  const cfg = visitor.cfg
  visitor.onresume = iter
  return iter()

  function run() {
    for (var i = 0; i < 1000; ++i) {
      if (visitor.paused) {
        return
      }
      if (!cfg.advance()) {
        if (!iterateUnexecuted(visitor)) {
          return ready()
        }
      }
    }
    if (i === 1000) {
      return setImmediate(iter)
    }
  }

  function iter() {
    try {
      run()
    } catch (err) {
      return ready(err)
    }
  }
}

function onfunction (visitor, fn, ast) {
  visitor.lastFunction = fn
  visitor.unexecutedFunctions.add(fn)

  var frame = visitor.cfg._callStack.current()
  if (frame) {
    visitor.stream.emit('defn', fn, frame.getFunction())
  }
  var caller = visitor.cfg._callStack.current().getFunction()
  fn.module = caller && caller.module ? caller.module :
    visitor.moduleStack[visitor.moduleStack.length - 1]
}

function oncall (visitor, fn, ctxt, args, isRecursion) {
  if (fn.isEither()) {
    // only skip the call if all of the outcomes have been visited.
    var shouldCall = false
    for (const xs of fn.outcomes()) {
      if (xs.isFunction() && !xs.isUnknown()) {
        if (oncall(visitor, xs, ctxt, args, isRecursion)) {
          // NB: can't bail early, we want to make sure
          // each fn gets removed.
          shouldCall = true
        }
      }
    }
    return shouldCall
  }

  if (visitor.cfg._callStack.current()) {
    visitor.stream.emit(
      'callfn', 
      visitor.cfg._callStack.current().getFunction(),
      fn
    )
  }
  // only (naturally) execute any given function once.
  if (fn.isFunction() &&
      !fn.isUnknown() &&
      fn.sharedFunctionInfo) {
    visitor.unexecutedFunctions.delete(fn)
    const sfi = fn.sharedFunctionInfo()
    if (sfi) {
      if (fn.call === RequireImpl) {
        return true
      }
      if (sfi._fakeCall) {
        return sfi.callCount() < 2
      }
      return sfi.callCount() < 1
    }
  }
}

function createEmptyProgramAST () {
  return {
    'type': 'Program',
    'body': []
  }
}

function onload (visitor, name, value, node) {
  if (value.isSpy) {
    visitor.cfg._valueStack.pop()
    visitor.cfg._valueStack.push(value.cloneLoad(node.name))
  }
}

function iterateUnexecuted (visitor) {
  const func = visitor.unexecutedFunctions.next()
  if (!func) {
    return
  }
  const sfi = func.sharedFunctionInfo()
  const arity = sfi.arity()
  const args = new Array(arity)
  const argNames = sfi.parameters()
  sfi._fakeCall = true
  const marks = func.getMark('ioc')
  if (marks.length) {
    const spy = marks[0]
    for (var i = 0; i < arity; ++i) {
      args[i] = spy.makeIOCArgument(argNames[i], i)
    }
    visitor.stream.emit('ioc-callfn', spy, func)
  } else {
    for (var i = 0; i < arity; ++i) {
      args[i] = visitor.cfg.makeUnknown()
    }
  }

  var sourceFunction = null
  for (var xs of func._references) {
    var source = xs.getCurrentSourceObject()

    // skip the function's own prototype object
    // (fn.prototype.constructor === fn)
    if (source === func.getprop('prototype').value()) {
      continue
    }

    for (var xs of source._references) {
      if (xs._name === 'prototype') {
        sourceFunction = xs.getCurrentSourceObject()
        break
      }
    }

    if (sourceFunction) {
      break
    }
  }
  var context = sourceFunction && sourceFunction.makeNew ?
    sourceFunction.makeNew() :
    visitor.cfg.makeUnknown()

  visitor.cfg.insertFrame(oncomplete)
  visitor.moduleStack.push(func.module)
  func.call(visitor.cfg, context, args)
  return true

  function oncomplete () {
    visitor.moduleStack.pop()
    visitor.cfg._valueStack.pop()
    return true
  }
}
