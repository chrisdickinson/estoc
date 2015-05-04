'use strict'

module.exports = Visitor

var defineRuntime = require('./define-runtime.js')
var escontrol     = require('escontrol')

function Visitor(opts, stream, pkg, filename, parent) {
  this.assumeDefined = opts.assumeDefined === void 0 ? true : opts.assumeDefined
  this.maxIterations = opts.maxIterations || Infinity
  this.maxCalls      = opts.maxCalls || 10
  this._cache        = parent ? parent._cache : new Map()
  this._filename     = filename
  this._stream       = stream
  this._queue        = null
  this._parent       = parent
  this._baseCFG      = null
  this._package      = pkg
  this._paused       = 0
  this.advance       = null
  this.cfg           = null

  this.reportUsage   = parent ? parent.reportUsage : this._reportUsage.bind(this)
}

Visitor.current = null

var proto = Visitor.prototype

proto.deactivate = function() {
  var last = this.constructor.current
  this.constructor.current = null
  return last
}

proto.activate = function() {
  this.constructor.current = this
}

proto.beget = function(filename) {
  var child = new Visitor({
    maxIterations: this.maxIterations,
    assumeDefined: this.assumeDefined,
    maxCalls: this.maxCalls
  }, this._stream, this._package, filename, this)
  return child
}

proto.setAdvance = function(adv) {
  this.advance = adv
}

proto._depth = function() {
  var depth = 0
  var curs = this
  while (curs) {
    ++depth
    curs = curs._parent
  }
  return depth
}

proto.isPaused = function() {
  return this !== this.constructor.current
}

proto.pushFunction = function(fnValue) {
  var self = this
  while (self._parent) {
    self = self._parent
  }

  self._queue = new QueueNode(fnValue, self._queue)
}

proto.popFunction = function() {
  var self = this
  while (self._parent) {
    self = self._parent
  }

  var queue = self._queue
  if (queue) {
    self._queue = queue.next
    return queue.fn
  }
  return null
}

proto.getCachedModuleExport = function(filename) {
  return this._cache.get(filename)
}

proto.setCachedModuleExport = function(filename, val) {
  return this._cache.set(filename, val)
}

proto._reportUsage = function(usage) {
  this._stream.push(usage)
}

proto.getCFG = function(ast, opts) {
  opts = Object.create(opts)
  var hasBaseCFG = Boolean(this._baseCFG)
  if (hasBaseCFG) {
    opts.builtins = this._baseCFG.builtins()
    opts.global = this._baseCFG.global()
  }
  var cfg = escontrol(ast, opts)
  if (!hasBaseCFG) {
    this._baseCFG = cfg
    defineRuntime(cfg, this.reportUsage)
  }
  this.cfg = cfg
  return cfg
}

proto.package = function() {
  return this._package
}

function QueueNode(fnValue, next) {
  this.fn = fnValue
  this.next = next
}


