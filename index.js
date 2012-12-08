var parseArgs = require('parse-fn-args')

module.exports = Flow

function Flow () {}

Flow.prototype.def = function (layer, task, deps, fn) {
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

  fn = fn || function noop () {}
  deps = deps || parseArgs(fn)

  this['_task_' + task] = {
    fn: fn,
    deps: deps,
    layer: layer
  }
  return this
}

Flow.prototype.layer = function (name) {
  this.name = name
  return this
}

Flow.prototype.eval = function (task, cb) {
  if (this[task] !== undefined) {
    this[task] instanceof Error
      ? cb.call(this, this[task])
      : cb.call(this, null, this[task])
    return this
  }
  var eval = '_evaluation_' + task
  if (!this[eval]) {
    new Evaluation(this, cb)
      .task(task)
      .start()
  } else {
    cb && this[eval].ondone(cb)
  }
  return this
}

Flow.prototype.run = function (task, cb) {
  return Object.create(this)
}

Flow.prototype.set = function (name, val) {
  this[name] = val
  return this
}


function Evaluation (flow, cb) {
  this.flow = flow
  this.callbacks = []
  this.deps = []
  cb && this.ondone(cb)
}

Evaluation.prototype.ondone = function (cb) {
  this.callbacks.push(cb)
}

Evaluation.prototype.task = function (name) {
  this.name = name
  this.t = this.flow['_task_' + name]
  if (!this.t) return this.done('Task "' + this.name + '" is not defined')
  this.setApp()
  this.app['_eval_' + this.name] = this
  return this
}

Evaluation.prototype.setApp = function () {
  if (!this.t.layer) return this.app = this.flow
  var app = this.flow
  while (app.name && (app.name != this.t.layer || !app.hasOwnProperty('name'))) {
    app = app.__proto__
  }
  this.app = app.name == this.t.layer ? app : this.flow
}

Evaluation.prototype.start = function () {
  this.evalDeps(0)
}

Evaluation.prototype.evalDeps = function (index) {
  var sync = true,
      self = this,
      deps = this.t.deps

  while (sync) {
    var dep = deps[index]
    if (!dep) return this.exec()

    if (dep == 'done') {
      this.async = true
      this.deps[index++] = this.done.bind(this)
      continue
    }

    var val = this.app[dep]
    if (val !== undefined) {
      if (val instanceof Error) return this.done(val)
      this.deps[index++] = val
      continue
    }

    var done = false

    this.app.eval(dep, function (err, val) {
      if (err) return self.done(err)
      done = true
      self.deps[index++] = val
      if (sync) return
      self.evalDeps(index)
    })

    sync = done
  }
}

Evaluation.prototype.exec = function () {
  try {
    if (this.async) {
      this.t.fn.apply(this.app, this.deps)
    } else {
      this.done(null, this.t.fn.apply(this.app, this.deps))
    }
  } catch (e) {
    this.done(e)
  }
}

Evaluation.prototype.done = function (err, val) {
  if (this.ended) {
    console.error('Task <' + this.name + '> called its callback twice')
    if (err) {
      console.error('It seems that it happened due to exception in a task callback:')
      err.stack ? console.error(err.stack) : console.error(String(err))
    }
    return
  }
  this.ended = true

  if (err != null) {
    if (!err instanceof Error) {
      err = new Error(String(err))
    }
    err.task = err.task || this.name
    this.app[this.name] = err
  } else {
    val = val === undefined ? null : val
    this.app[this.name] = val
  }
  this.app['_evaluation_' + this.name] = null // cleanup
  for (var i = 0; i < this.callbacks.length; i++) {
    this.callbacks[i].call(this.flow, err, val)
  }
}

