module.exports = Usage

const Visitor = require('./visitor.js')

function Usage(type, cfg, name, args) {
  // XXX: this is a hack.
  if (cfg !== Visitor.current.cfg) {
    cfg = Visitor.current.cfg
  }
  var frame = cfg._callStack.current()
  var fromFile = '!!!'
  if (frame && frame._func) {
    fromFile = frame._func.filename || '???'
  } else {
  }

  this._type = type
  this._name = name.slice()
  this._loc = cfg.lastASTNode().loc
  this._file = fromFile
  this._args = args
  this._exc = cfg.getExceptionDestination()
}

Usage.LOOKUP = 0
Usage.LOAD = 1
Usage.CALL = 2

var proto = Usage.prototype

proto.info = function() {
  return [
    'lookup',
    'load',
    'call'
  ][this._type] + ' ' + this._name.join('.') + ' at ' +
  this._file + ':' + this._loc.start.line + ' ' + this.formatTryCatch()
}

proto.formatTryCatch = function() {
  if (!this._exc) {
    return ''
  }

  if (!this._exc.frame) {
    return '<no frame>'
  }

  if (!this._exc.frame._func) {
    return '<no func>'
  }

  return 'throws to ' + this._exc.frame._func._name +
    ':' +
    this._exc.frame._func.filename + 
    (this._exc.block.node ? ':' + this._exc.block.node.loc.start.line : '')
}
