'use strict'

module.exports = Spy

const ObjectValue = require('escontrol/lib/values/object')
const inherits = require('inherits')

function Spy (parent, access, visitor, parentMap) {
  ObjectValue.call(
    this,
    visitor.cfg,
    -1,
    visitor.cfg._builtins.getprop('[[FunctionProto]]').value(),
    parentMap
  )
  this.access = access
  this.parent = parent
  this.visitor = visitor
}

inherits(Spy, ObjectValue)

const proto = Spy.prototype

Spy.REQUIRE = 'require'
Spy.IOCARG = 'ioc-arg'
Spy.OBJECTLOAD = 'object'
Spy.CONTEXTLOAD = 'context'
Spy.RETURNVAL = 'return-value'
Spy.INSTANT = 'instantiate'
Spy.OBJECTDELETE = 'delete'

Spy.createRoot = function (visitor, name) {
  return new Spy(null, makeAccess(visitor, Spy.REQUIRE, name), visitor)
}

proto.cloneLoad = function (name) {
  // this is just for testing:
  var spy = new Spy(this.parent, makeAccess(this.visitor, Spy.CONTEXTLOAD, this.access.name), this.visitor)
  this.visitor.report(spy)
  return spy

  // this should be actually used:
  var spy = new Spy(this, makeAccess(this.visitor, Spy.CONTEXTLOAD, name), this.visitor)
  this.visitor.report(spy)
  return spy
}

proto.getprop = function (prop, immediate) {
  var name = ObjectValue.prototype.getprop.call(this, prop, immediate)
  if (!name) {
    name = this.newprop(prop)
    var spy = new Spy(
      this,
      makeAccess(this.visitor, Spy.OBJECTLOAD, prop),
      this.visitor
    )
    this.visitor.report(spy)
    name.assign(spy)
  }

  return name
}

proto.delprop = function (propname) {
  var retVal = ObjectValue.prototype.delprop.call(this, propname)
  var spy = new Spy(
    this,
    makeAccess(this.visitor, Spy.OBJECTDELETE, propname),
    this.visitor
  )
  this.visitor.report(spy)
  return retVal
}

proto.copy = function () {
  return new Spy(
    this,
    this.access,
    this.visitor,
    this._attributes
  )
}

proto.isFunction = function () {
  return true
}

proto.isSpy = true

proto.classInfo = function () {
  return '<Spy>'
}

proto.instantiate = function (cfg, args) {
  var spy = new Spy(
    this,
    makeAccess(this.visitor, Spy.INSTANT, '<instant>'),
    this.visitor
  )
  this.visitor.report(spy, args)
  for (var i = 0; i < args.length; ++i) {
    if (args[i].isFunction()) {
      args[i].setMark('ioc', this)
    }
  }
  this.visitor.cfg._valueStack.push(spy)
}

proto.call = function (cfg, ctxt, args, isNew, branch) {
  var spy = new Spy(
    this,
    makeAccess(this.visitor, Spy.RETURNVAL, '<return-value>'),
    this.visitor
  )
  this.visitor.report(spy, args)
  for (var i = 0; i < args.length; ++i) {
    if (args[i].isFunction()) {
      args[i].setMark('ioc', this)
    }
  }
  this.visitor.cfg._valueStack.push(spy)
}

proto.makeIOCArgument = function (name, idx) {
  var spy = new Spy(this, {
    manner: Spy.IOCARG,
    filename: this.access.filename,
    position: this.access.position,
    name: '<arg #' + idx + ': ' + name + '>'
  }, this.visitor)
  this.visitor.report(spy)
  return spy
}

function makeAccess (visitor, manner, name) {
  var lastFn = visitor.cfg._callStack.current().getFunction()
  var lastAST = visitor.cfg.lastASTNode() || {loc: {start: 0, column: 0}}
  var module = (lastFn ? lastFn.module : null) || {filename: '<builtin>'}
  return {
    manner: manner,
    filename: module.filename,
    position: lastAST.loc || {start: {line: 0, column: 0}},
    name: name
  }
}
