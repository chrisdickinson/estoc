"use strict"

module.exports = inspectCode

var makeTrackable = require('./lib/make-trackable.js')
var defineRuntime = require('./lib/define-runtime.js')
var escontrol = require('escontrol')
var path = require('path')

function inspectCode(baseCFG, cache, filename, pkg, ast, queue, ready) {
  var maxIterations = 1e4
  var cfg = escontrol(ast, {
    onoperation: onoperation,
    onfunction: onfunction,
    oncalled: oncalled,
    onload: onload,
    oncall: oncall,
    builtins: baseCFG ? baseCFG.builtins() : null,
    global: baseCFG ? baseCFG.global() : null
  })

  if (!baseCFG) {
    defineRuntime(cfg, trackUsage)
  }
  cfg.pause = pause
  cfg.resume = resume
  cfg.paused = 0
  var gotFunction = null
  var onFunctionMode = 0

  function trackUsage(obj, name, kind) {
    console.log('%s%s', pkg.name, name)
  }

  var requireFn = cfg.makeFunction(function(cfg, ctxt, args, isNew) {
    var target = args[0]

    if (!target.isString()) {
      return cfg._valueStack.push(cfg.makeUnknown())
    }

    var val = target._value
    if (!val) {
      return cfg._valueStack.push(cfg.makeUnknown())
    }

    //if (pkg.hasDependency(val.split(/\/\\/g)[0])) {
    //  return cfg._valueStack.push(cfg.makeUnknown())
    //}

    if (!/^(\w:\\|\\|\/|\.)/.test(val)) {
      return cfg._valueStack.push(makeTrackable(cfg, filename + ': ' + val, trackUsage))
    }

    if (global.cnt == 29) debugger
    cfg.pause()
    pkg.resolveFilename(filename, val, function(err, targetFile) {
      if (err) {
        return ready(err)
      }

      if (cache.has(targetFile)) {
        cfg.resume()
        cfg._valueStack.push(cache.get(targetFile))
        return iterate()
      }
      cache.set(targetFile, cfg.makeObject())

      if (path.extname(targetFile) === '.json') {
        cfg.resume()
        cfg._valueStack.push(cache.get(targetFile))
        return iterate()
      }

      pkg.getASTFor(targetFile, function(err, ast) {
        if (err) {
          return ready(err)
        }
        inspectCode(cfg, cache, targetFile, pkg, ast, queue, onready)
      })

      function onready(err, value) {
        if (err) {
          return ready(err)
        }

        cache.set(targetFile, value)
        cfg._valueStack.push(value)
        cfg.resume()
        iterate()
      }
    })
  })

  var moduleObj = cfg.makeObject()
  var exportsObj = cfg.makeObject()
  var filenameVal = cfg.makeValue('string', filename)
  var dirnameVal = cfg.makeValue('string', path.dirname(filename))
  var functions = []
  moduleObj.newprop('exports').assign(exportsObj)
  cache.set(filename, exportsObj)

  while(cfg.advance()) {
     /* noop */
  }

  if (!gotFunction) {
    return ready(new Error('could not find module wrapper!'))
  }

  gotFunction.call(cfg, cfg.global(), [
    exportsObj,
    requireFn,
    moduleObj,
    filenameVal,
    dirnameVal
  ])
  setImmediate(iterate)

  function iterate() {
    while (!cfg.paused && cfg.advance()) {
    }
    if (cfg.paused) return
    oncomplete()
  }

  function oncomplete() {
    cfg._edges.length = 0
    var cb = ready
    ready = noop
    if (functions.length) {
      queue.push(function(cb) {
        ready = cb
        functions = functions.filter(function(xs) {
          return xs.sharedFunctionInfo().callCount() === 0
        })
        setImmediate(iter)
      })
    }

    // this gets into weird territory.
    // cb(null, cfg.makeUnknown())
    cb(null, patchEntries(moduleObj.getprop('exports').value()))

    function patchEntries(value) {
      if (value.call) {
        return patchFunction(value)
      } 
      if (value.isObject()) {
        return patchObject(value)
      }
      return value
    }

    function patchObject(value) {
      if (!value._attributes) {
        return value
      }

      for (var key in value._attributes) {
        var prop = value.getprop(key)
        prop.assign(patchEntries(prop.value()))
      }

      return value
    }

    function patchFunction(value) {
      var baseCall = value.call
      var called = 0
      var cached = null
      value.call = function(cfg) {
        if (called++) {
          return cfg._valueStack.push(cached)
        }
        cfg._pushFrame(thunkCalled, {})
        return baseCall.apply(this, arguments)
      }
      // just capturing the return value!
      function thunkCalled() {
        cached = this._valueStack.current()
      }
      return value
    }


    function iter() {
      if (!functions.length) {
        var cb = ready
        ready = noop
        return cb(null)
      }
      var next = functions.shift()
      var sfi = next.sharedFunctionInfo()
      if (sfi.callCount()) {
        return iter(ready)
      }

      var argLen = next._code.params.length
      var args = []

      var marks = next.getMark('ioc')

      for(var i = 0; i < argLen; ++i) {
        args.push(marks.length ?
          makeTrackable(cfg, marks[0].concat(['<ioc-arg #' + i + '>']), trackUsage) :
          cfg.makeUnknown()
        )
      }

      next.call(cfg, cfg.makeUnknown(), args)
      try {
        iterate()
      } catch(err) {
        oncomplete()
      }
    }
  }

  function onoperation(args, op, result) {

  }

  function oncall(fn, context, args, recursion) {
  }

  function oncalled(fn, context, args, recursion, result) {

  }

  function onload(name, value) {
    if (value.__title__) {
      trackUsage(null, value.__title__.join('.') + ' (as ' + name.getName() + ')')
    }
  }

  function onfunction(fn, astNode) {
    switch (onFunctionMode) {
      case 0:
        gotFunction = fn
        onFunctionMode = 1
      break;
      case 1:
        functions.push(fn)
        // hah, okay. cool story, really.
      break;
    }
  }

  function pause() {
    if (baseCFG && baseCFG.pause) baseCFG.pause()
    ++cfg.paused
  }

  function resume() {
    if (baseCFG && baseCFG.resume) baseCFG.resume()
    --cfg.paused
  }
}

function noop() {

}
