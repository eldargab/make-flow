var parseArgs = require('parse-fn-args')

module.exports = Flow

function Flow() {
  if (!(this instanceof Flow)) {
    return new Flow
  }
}

Flow.prototype.thisPromises = function() {
  if (this.promises.__owner === this) return this.promises
  return this.promises = {
    __proto__: this.__proto__.thisPromises(),
    __owner: this
  }
}

Flow.prototype.promises = {__owner: Flow.prototype}

Flow.prototype.thisTasks = function() {
  if (this.tasks.__owner === this) return this.tasks
  return this.tasks = {
    __proto__: this.__proto__.thisTasks(),
    __owner: this
  }
}

Flow.prototype.tasks = {__owner: Flow.prototype}


Flow.prototype.set = function(name, val) {
  this[name] = val
  return this
}

Flow.prototype.def = function(layer, task, deps, fn) {
  if (typeof task != 'string') { // allow layer omission
    fn = deps
    deps = task
    task = layer
    layer = null
  }

  if (typeof deps == 'function') { // allow implicit deps
    fn = deps
    deps = fn.deps
  }

  fn = fn || noop
  deps = deps || parseArgs(fn)

  this.thisTasks()[task] = {
    fn: fn,
    deps: deps,
    sync: !~deps.indexOf('done'),
    layer: layer || this._at
  }

  return this
}

Flow.prototype.layer = function(name) {
  this._layer = name
  return this
}

Flow.prototype.at = function(layer, fn) {
  var prev = this._at
  this._at = layer
  try {
    fn(this)
  } finally {
    this._at = prev
  }
  return this
}

Flow.prototype.run = function() {
  return {__proto__: this}
}

Flow.prototype.fn = function(fn) {
  var self = this
  return function() {
    fn.apply(self.run(), arguments)
  }
}

Flow.prototype.eval = function(task, cb) {
  cb = cb || noop

  var val = this[task]
  if (val !== undefined) {
    val instanceof Error
      ? cb(val)
      : cb(null, val)
    return
  }

  var promise = this.promises[task]
  if (promise) return promise.ondone(cb)

  var t = this.tasks[task]
  if (!t) return cb(new Error('Task ' + task + ' is not defined'))

  evaluate(this, task, t, cb)
}

function evaluate(app, name, t, cb) {
  if (t.layer) app = find(app, t.layer)

  var done = false
    , promise

  function ondone(err, val) {
    if (done) return printDoubleCallbackWarning(name, err)
    done = true
    if (err != null) {
     if (!(err instanceof Error)) {
        var orig = err
        err = new Error('None error object was throwed')
        err.orig = orig
      }
      if (val != '__DEP__') {
        err._task = name
        err._layer = app._layer
      }
      err._stack = err._stack ? name + '.' + err._stack : name
      val = err
    }

    if (val === undefined) val = null

    app[name] = val

    if (app.promises.__owner === app) {
      app.promises[name] = null // cleanup
    }

    cb(err, val)

    if (promise) promise.resolve(err, val)
  }

  evalWithDeps(app, t, new Array(t.deps.length), 0, ondone)

  if (!done) {
    app.thisPromises()[name] = promise = new Promise
  }
}

function evalWithDeps(app, t, deps, start, ondone) {
  var sync = true
  for (var i = start; i < t.deps.length; i++) {
    var dep = t.deps[i]

    if (dep == 'done') {
      deps[i] = ondone
      continue
    }

    var val = app[dep]
    if (val !== undefined) {
      if (val instanceof Error) return ondone(val, '__DEP__')
      deps[i] = val
      continue
    }

    var done = false

    app.eval(dep, function(err, val) {
      if (err) return ondone(err, '__DEP__')
      done = true
      deps[i] = val
      if (sync) return
      evalWithDeps(app, t, deps, i + 1, ondone)
    })
    sync = done
    if (!sync) return
  }
  exec(app, t, deps, ondone)
}

function exec(app, t, deps, ondone) {
  var ret
  try {
    ret = t.fn.apply(app, deps)
  } catch (e) {
    ondone(e)
    return
  }
  if (t.sync) ondone(null, ret)
}

function find(app, layer) {
  var top = app
  while (app._layer && (app._layer != layer || !app.hasOwnProperty('_layer'))) {
    app = app.__proto__
  }
  return app._layer == layer ? app : top
}

function Promise() { }

Promise.prototype.ondone = function(cb) {
  this.callbacks = this.callbacks || []
  this.callbacks.push(cb)
}

Promise.prototype.resolve = function(err, val) {
  if (!this.callbacks) return
  for (var i = 0; i < this.callbacks.length; i++) {
    this.callbacks[i](err, val)
  }
}

function printDoubleCallbackWarning(task, err) {
  var msg = 'Callback for the task `' + task + '` was called two times'
  if (err) {
    msg += '\n'
    msg += 'Perhaps it is happened due to exception in an eval callback'
    msg += '\n' + (err.stack || String(err))
  }
  console.error(msg)
}

function noop() {}
