var parse = require('parse-fn-args')

module.exports = Flow

function Flow () {}

Flow.prototype.def = function (task, deps, fn) {
  if (typeof deps == 'function') {
    fn = deps
    deps = fn.deps
  }
  this['_fn_' + task] = fn || function noop () {}
  this['_deps_' + task] = deps || parse(fn)
  return this
}

Flow.prototype.eval = function (task, cb) {
  if (this[task] !== undefined) {
    this[task] instanceof Error
      ? cb.call(this, this[task])
      : cb.call(this, null, this[task])
    return this
  }
  var promise = '_promise_' + task
  if (!this[promise]) {
    this[promise] = new Promise(this, task)
    cb && this[promise].ondone(cb)
    this[promise].eval()
  } else {
    cb && this[promise].ondone(cb)
  }
  return this
}

Flow.prototype.run = function (task, cb) {
  var instance = Object.create(this)
  task && instance.eval(task, cb)
  return instance
}

Flow.prototype.set = function (name, val) {
  this[name] = val
  return this
}


function Promise (flow, task) {
  this.flow = flow
  this.task = task
  this.fn = this.flow['_fn_' + task]
  if (!this.fn) throw new Error('Task "' + task + '" is not defined')
  this.deps = this.flow['_deps_' + task]
  this.callbacks = []
}

Promise.prototype.ondone = function (cb) {
  this.callbacks.push(cb)
}

Promise.prototype.eval = function () {
  this.deps.length ? this.evalWithDeps(0) : this.exec()
}

Promise.prototype.evalWithDeps = function (index) {
  var sync = true, self = this
  while (sync) {
    var dep = this.deps[index]
    if (!dep) return this.exec()
    if (dep == 'done') {
      this.async = true
      this.deps[index++] = this.done.bind(this)
      continue
    }
    var val = this.flow[dep]
    if (val !== undefined) {
      if (val instanceof Error) return this.done(val)
      this.deps[index++] = val
      continue
    }
    var done = false
    this.flow.eval(dep, function (err, val) {
      if (err) return self.done(err)
      done = true
      self.deps[index++] = val
      if (sync) return
      self.deps.length > index // safe stack space if it's easy to safe
        ? self.evalWithDeps(index)
        : self.exec()
    })
    sync = done
  }
}

Promise.prototype.exec = function () {
  try {
    if (this.async) {
      this.fn.apply(this.flow, this.deps)
    } else {
      this.done(null, this.fn.apply(this.flow, this.deps))
    }
  } catch (e) {
    this.done(e)
  }
}

Promise.prototype.done = function (err, val) {
  if (err != null) {
    if (!err instanceof Error) {
      err = new Error(String(err))
    }
    err.task = err.task || this.task
    this.flow[this.task] = err
  } else {
    val = val === undefined ? null : val
    this.flow[this.task] = val
  }
  this.flow['_promise_' + this.task] = null // cleanup
  for (var i = 0; i < this.callbacks.length; i++) {
    this.callbacks[i].call(this.flow, err, val)
  }
}

