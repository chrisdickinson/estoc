module.exports = inspectCode

var makeTrackable = require('./lib/make-trackable.js')
var escontrol = require('escontrol')
var path = require('path')

function inspectCode(baseCFG, cache, filename, pkg, ast, queue, ready) {
  var maxIterations = 1e4
  var cfg = escontrol(ast, {
    onoperation: onoperation,
    onfunction: onfunction,
    oncalled: oncalled,
    oncall: oncall,
    builtins: baseCFG ? baseCFG.builtins() : null,
    global: baseCFG ? baseCFG.global() : null
  })
  var paused = false
  var gotFunction = null
  var onFunctionMode = 0

  var requireFn = cfg.makeFunction(function(cfg, ctxt, args, isNew) {
    var target = args[0]

    if (!target.isString()) {
      return cfg._valueStack.push(cfg.makeUnknown())
    }

    var val = target._value
    if (!val) {
      return cfg._valueStack.push(cfg.makeUnknown())
    }

    if (pkg.hasDependency(val.split(/\/\\/g)[0])) {
      return cfg._valueStack.push(cfg.makeUnknown())
    }

    if (!/^(\w:\\|\\|\/|\.)/.test(val)) {
      return cfg._valueStack.push(makeTrackable(cfg, val, function(obj, name) {
        console.log('%s%s: %s', pkg.name, filename, name)
      }))
    }

    paused = true

    pkg.resolveFilename(filename, val, function(err, targetFile) {
      if (err) {
        return ready(err)
      }

      if (cache.has(targetFile)) {
        paused = false
        cfg._valueStack.push(cache.get(targetFile))
        return iterate()
      }
      cache.set(targetFile, cfg.makeObject())

      if (path.extname(targetFile) === '.json') {
        paused = false
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
        paused = false
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
    var i = 0
    while (cfg.advance()) {
      if (paused) {
        return
      }
    }
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
        iter()
      })
    }

    
    cb(null, cfg.makeUnknown())
    // this gets into weird territory.
    // cb(null, moduleObj.getprop('exports').value())

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

      for(var i = 0; i < argLen; ++i) {
        args.push(cfg.makeUnknown())
      }

      next.call(cfg, cfg.makeUnknown(), args)
      try {
        iterate()
      } catch(err) {
        console.log(err.stack)
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
}

function noop() {

}
