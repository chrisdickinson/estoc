'use strict'

module.exports = makeTrackable

var Visitor = require('./visitor.js')
var Usage = require('./usage.js')

function makeTrackable(cfg, title, trackProgression) {
  var object = cfg.makeFunction(oncall)

  object.classInfo = identity

  return makeTrackableFrom(object, Array.isArray(title) ? title : [title])

  function oncall(cfg, thisObj, args) {
    var title = this.getMark('tracked-name')[0]
    var newTitle = title.concat([Usage.makeReturnValueSegment(Visitor.current)])
    var lastPath = title[title.length - 1]
    switch (lastPath) {
      case 'on':
      case 'once':
      case 'addListener':
        if (args[0] && args[0].isString()) {
          title = title.slice()
          title[title.length - 1] = 'on "' + args[0]._value + '"'
        }
      break;
    }
    for (var i = 0, len = args.length; i < len; ++i) {
      if (args[i].isFunction()) {
        args[i].setMark('ioc', title)
      }
    }
    trackProgression(new Usage(Usage.CALL, cfg, title, args.map(function(arg) {
      return arg.getHCID()
    })))
    cfg._valueStack.push(makeTrackable(cfg, newTitle, trackProgression))
  }

  function makeTrackableFrom(base, title) {
    var obj = Object.create(base)
    obj.getprop = getprop
    obj.delprop = delprop
    obj.setMark('tracked-name', title)
    obj.copy = copy
    return obj

    function copy() {
      var newVal = base.copy.call(obj)
      newVal.copy = copy
      newVal.getprop = getprop
      return newVal
    }

    function delprop(name) {
      var target = makeTrackableFrom(cfg.makeFunction(oncall), title.concat([name]))
      var marks = this.getMark('tracked-name')
      trackProgression(new Usage(Usage.DELETE, cfg, marks[0]))
      return base.delprop.call(this, arguments)
    }

    function getprop(name) {
      var baseName = base.getprop.call(this, arguments)
      if (!baseName) {
        baseName = this.newprop(name)
        baseName.assign(makeTrackable(cfg, title.concat([name]), trackProgression))
      }
      var newName = Object.create(baseName)
      newName.value = getvalue
      return newName

      function getvalue() {
        var baseValue = baseName.value.call(this, arguments)
        if (!baseValue) return
        var marks = baseValue.getMark('tracked-name')
        if (marks.length) {
          trackProgression(new Usage(Usage.LOOKUP, cfg, marks[0]))
          return baseValue
        }

        // existing property
        var target = makeTrackableFrom(baseValue, title.concat([name]))
        trackProgression(new Usage(Usage.LOOKUP, cfg, marks[0]))
        return target
      }
    }
  }
}

function identity() {
  return '(SPY)'
}
