'use strict'

module.exports = handleExternalModule

function handleExternalModule (visitor, sourceModule, targetName) {
  var spy = visitor.createSpy(targetName)
  visitor.report(spy)
  return visitor.cfg._valueStack.push(spy)
}

