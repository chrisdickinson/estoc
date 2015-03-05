"use strict"

module.exports = makeTrackable

function makeTrackable(cfg, title, trackProgression) {
  return makeTrackableFrom(cfg.makeUnknown(), title)

  function makeTrackableFrom(base, title) {
    var obj = Object.create(base)
    obj.getprop = getprop
    obj.__title__ = title
    return obj

    function getprop(name) {
      var baseName = base.getprop.call(this, arguments)
      var newName = Object.create(baseName)
      newName.value = getvalue
      return newName

      function getvalue() {
        var baseValue = baseName.value.call(this, arguments)
        if (!baseValue) return
        var target = makeTrackableFrom(baseValue, title + '.' + name)
        trackProgression(target, target.__title__)
        return target
      }
    }
  }
}
