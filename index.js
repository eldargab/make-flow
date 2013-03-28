var parseArgs = require('parse-fn-args')

module.exports = Flow

function Flow() {
  if (!(this instanceof Flow)) {
    return new Flow
  }
}

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

  fn = fn || function noop() {}
  deps = deps || parseArgs(fn)

  this['_task_' + task] = {
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

Flow.prototype.run = function(task, cb) {
  return Object.create(this)
}

Flow.prototype.eval = function(task, cb) {
  cb = cb || noop

  var val = this[task]
  if (val !== undefined) {
    val instanceof Error
      ? cb.call(this, val)
      : cb.call(this, null, val)
    return this
  }

  var ondone = this['_ondone_' + task]
  if (ondone) {
    ondone(cb)
    return this
  }

  var def = this['_task_' + task]
  if (!def) {
    cb.call(this, new Error('Task ' + task + ' is not defined'))
    return this
  }
  evaluate(this, task, def, cb)
  return this
}

function evaluate(instance, task, def, cb) {
  if (def.layer) instance = find(instance, def.layer)

  var done = false
    , callbacks

  function ondone(err, val) {
    if (done) return printDoubleCallbackWarning(task, err)
    done = true
    if (err != null) {
      if (!(err instanceof Error)) {
        var orig = err
        err = new Error('None error object was throwed')
        err.orig = orig
      }
      if (val != '__DEP__') err._task = task
      err._stack = err._stack ? task + '.' + err._stack : task
      val = err
    }
    if (val === undefined) val = null
    instance[task] = val
    instance['_ondone_' + task] = null // cleanup
    cb.call(instance, err, val)
    if (callbacks) {
      for (var i = 0; i < callbacks.length; i++) {
        callbacks[i].call(instance, err, val)
      }
    }
  }

  evalWithDeps(instance, def, new Array(def.deps.length), 0, ondone)

  if (!done) {
    instance['_ondone_' + task] = function(fn) {
      (callbacks || (callbacks = [])).push(fn)
    }
  }
}

function find(i, layer) {
  var top = i
  while (i._layer && (i._layer != layer || !i.hasOwnProperty('_layer'))) {
    i = i.__proto__
  }
  return i._layer == layer ? i : top
}

function evalWithDeps(instance, def, deps, start, ondone) {
  var sync = true
  for (var i = start; i < def.deps.length; i++) {
    var dep = def.deps[i]

    if (dep == 'done') {
      deps[i] = ondone
      continue
    }

    var val = instance[dep]
    if (val !== undefined) {
      if (val instanceof Error) return ondone(val, '__DEP__')
      deps[i] = val
      continue
    }

    var done = false

    instance.eval(dep, function(err, val) {
      if (err) return ondone(err, '__DEP__')
      done = true
      deps[i] = val
      if (sync) return
      evalWithDeps(instance, def, deps, i, ondone)
    })
    sync = done
    if (!sync) return
  }
  exec(instance, def, deps, ondone)
}

function exec(instance, def, deps, ondone) {
  var ret
  try {
    ret = def.fn.apply(instance, deps)
  } catch (e) {
    ondone(e)
    return
  }
  if (def.sync) ondone(null, ret)
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
