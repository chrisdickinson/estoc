'use strict'

module.exports = class UnexecutedList {
  constructor () {
    this._map = new Map()
    this._generation = 0
  }
  next () {
    ++this._generation
    if (!this._map.size) { 
      return null
    }
    var weights = new Map()
    var out = []
    for (var pair of this._map) {
      weights.set(pair[1], getWeight(pair[0], pair[1], this._generation))
      out.push(pair[1])
    }
    var fn = out.sort(function (lhs, rhs) {
      lhs = weights.get(lhs)
      rhs = weights.get(rhs)
      return lhs < rhs ? 1 :
        lhs > rhs ? -1 : 0
    })[0]

    this.delete(fn)
    return fn
  }
  add (fn) {
    fn.sharedFunctionInfo()._generation = this._generation
    this._map.set(fn.sharedFunctionInfo(), fn)
  }
  delete (fn) {
    this._map.delete(fn.sharedFunctionInfo())
  }
}

function getWeight (sfi, fn, gen) {
  var size = Math.min(sfi._node.loc.end.line - sfi._node.loc.start.line, 500) / 500
  var numRefs = Math.min(fn._references.size, 100) / 100
  var arity = 10 - Math.min(sfi.arity(), 10) / 10
  var generation = (100 - Math.min(gen - sfi._generation, 100)) / 100
  return Number(Boolean(sfi.isExport)) + size * 0.75 + generation * 0.25
}
