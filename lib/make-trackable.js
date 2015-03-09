"use strict"

module.exports = makeTrackable

function makeTrackable(cfg, title, trackProgression) {
  var object = cfg.makeFunction(oncall)

  return makeTrackableFrom(object, Array.isArray(title) ? title : [title])

  function oncall(cfg, thisObj, args) {
    var title = this.__title__
    var newTitle = title.concat(['<return-value>'])
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

    cfg._valueStack.push(makeTrackable(cfg, newTitle, trackProgression))
  }

  function makeTrackableFrom(base, title) {
    var obj = Object.create(base)
    obj.getprop = getprop
    obj.__title__ = title
    obj.copy = copy
    return obj

    function copy() {
      var newVal = base.copy.call(obj)
      newVal.__title__ = obj.__title__
      newVal.copy = copy
      newVal.getprop = getprop
      return newVal
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
        if (baseValue.__title__) {
          trackProgression(baseValue, baseValue.__title__.join('.'))
          return baseValue
        }

        // existing property
        var target = makeTrackableFrom(baseValue, title.concat([name]))
        trackProgression(target, target.__title__.join('.'))
        return target
      }
    }
  }
}
