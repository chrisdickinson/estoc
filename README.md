# estoc

This module allows users to statically track uses of external packages in a
given package. Any required module that is not directly part of the package is
considered external – whether it be a dependency or a core module. All usage of
external functionality is reported, including calls, return values, and
inversion-of-control callbacks.

```javascript
var Transform = require('stream').Transform
var estoc = require('estoc')

var toString = Transform({
  objectMode: true,
  transform: function(usage, _, ready) {
    ready(null, new Buffer(
      usage.info() + '\n'
    ))
  }
})

// works with directories containing package.json files
estoc('path/to/packageDir').pipe(toString).pipe(process.stdout)

// as well as npm-cache-style tarballs
estoc('path/to/package.tgz').pipe(toString).pipe(process.stdout)
```

## How does it work?

estoc uses [escontrol](http://npm.im/escontrol) as a stack machine to simulate
executing JavaScript code. While estoc provides the Node-specific glue,
escontrol simulates a modern JS runtime. escontrol will trace into any known
function call, while estoc builds a queue of "unexecuted" functions. Once
escontrol completes, estoc will simulate a call to the next "unexecuted"
function, popping it off the stack, until there are no more "unexecuted"
functions available.

It does not boil the ocean, but it does throw several microwaves into the
Pacific.

## API

### `estoc(filename[, estocOptions][, ready])` → `Readable<Usage>()`

Given `filename`, which should be a path to a directory containing
`package.json` or a tarball file, return a readable stream of [`Usage`](#usage)
objects. May optionally be passed [options](#estocoptions) to control the AST
visitor, as well as a `ready(err)` callback to be called once analysis is
complete.

#### `estocOptions`

* `assumeDefined` – Assume unresolvable modules are defined. Prevents crashing
on unknown file types. Defaults to `true`.
* `maxIterations` – Maximum number of iterations per event loop turn. Use this to
prevent starving the event loop. Defaults to `Infinity`.
* `maxCalls` – Maximum number of times a given function will be "called" – this limits
the number of times a function will be visited with different type information. Defaults
to `1`. Increase for more accurate type information. Decrease for quicker execution.

### `Usage`

A single usage of an external object or externally derived property. May be a
call, lookup, or direct load of a variable name.

#### `usage.type()` →  `String("lookup" | "load" | "call")`

Returns the type of usage.

* `load` – a direct load from scope.
* `lookup` – a property lookup from an existing tracked value.
* `call` – a call (or instantiation) of a tracked value.

#### `usage.info()` →  `String`

Will return a string of format `"{A} {B} at {C}:{D} {E}"`, where:

* `A`: The type of usage, whether that be lookup, load, or call.
* `B`: The full path of the usage.
* `C`: The file in which the usage occurred.
* `D`: The line at which the usage occurred.
* `E`: If available, information on the exception target of the usage.

##### Usage path format

The usage path format is `.`-delimited, and may contain the following types of segments:

* `name` – simple name load or lookup.
* `name (as xyz)` – a load that has been assigned to a variable named `xyz`.
* `<return-value (from functionName filename:line)>` – the result of calling an external value. The origin of the return-value is tracked in parentheses.
* `<ioc-arg #N>` – the Nth "inversion of control" argument. These are callbacks passed to external packages, and are executed with incomplete type information.
* `on "eventName"` – sugar for a call to `EventEmitter.prototype.on`, with the supplied event name.

#### `usage.formatTryCatch()` →  `String("" | "<no frame>" | "<no func>" | "throws to...")`

Returns a string representing the location the usage will throw an exception to on error.
If `""`, `<no frame>`, or `<no func>` are returned, the usage will thrown an exception to
the top of scope.

`throws to...`-style exceptions will throw to a known `try` statement.

## License

MIT
