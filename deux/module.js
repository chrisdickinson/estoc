'use strict'

module.exports = exportModule()

const RequireImpl = require('./require-impl.js')
const path = require('path')

function exportModule () {
  return class Module {
    constructor(filename, ast, exportsObject) {
      this.filename = filename
      this.ast = ast
      this.exports = exportsObject
      this.complete = false
    }
    execute(visitor) {
      return executeModule(visitor, this)
    }
  }
}

function executeModule (visitor, module) {
  if (visitor.moduleCache.has(module)) {
    return visitor.moduleCache.get(module).exports
  }
  const moduleObject = visitor.cfg.makeObject()
  moduleObject.newprop('exports').assign(module.exports)
  visitor.moduleStack.push(module)
  visitor.cfg.insertFrame(pauseOnModuleWrapper)

  const currentScope = visitor.cfg.resetScope()
  return visitor.cfg._visit(module.ast)

  function pauseOnModuleWrapper () {
    visitor.cfg.resetScope(currentScope)
    const filenameValue = visitor.cfg.makeValue(
      'string',
      module.filename
    )
    const dirnameValue = visitor.cfg.makeValue(
      'string',
      path.dirname(module.filename)
    )

    visitor.moduleCache.set(module, module.exports)
    // re-set the breakpoint
    visitor.cfg.insertFrame(pauseOnExecutedModule)
    visitor.unexecutedFunctions.delete(visitor.lastFunction)
    visitor.lastFunction.module = module
    visitor.lastFunction.call(visitor.cfg, visitor.cfg.global(), [
      module.exports,
      getRequireFor(visitor, module),
      moduleObject,
      filenameValue,
      dirnameValue
    ])

    // resume execution!
    return true
  }

  function pauseOnExecutedModule () {
    visitor.moduleStack.pop()
    module.exports = moduleObject.getprop('exports').value()

    if (module.exports.sharedFunctionInfo) {
      module.exports.sharedFunctionInfo().isExport = true
    }
    if (module.exports.names) {
      for (var name of module.exports.names()) {
        if (name.value() && name.value().sharedFunctionInfo) {
          name.value().sharedFunctionInfo().isExport = true
        }
      }
    }
    visitor.cfg._valueStack.pop()
    visitor.cfg._valueStack.push(module.exports)
    module.complete = true
    return true
  }
}

function getRequireFor (visitor, module) {
  var fn = visitor.cfg.makeFunction(RequireImpl)
  fn.visitor = visitor
  fn.module = module
  return fn
}
