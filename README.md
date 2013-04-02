# make-flow

## Motivation

Generally, callback hell problem arises when there is a bunch
of interdependent async computations. Rather then trying to emulate
sync control flow with verious funky utils we can be declarative
and specify not `HOW` to compute, but `WHAT` to compute. Let's consider the
following example:

```javascript
def('a', function() {
  return 'a'
})

def('b', function(a) {
  return 'b'
})

def('c', function(a, b) {
  return a + b
})

def('d', function(a, c) {
  return a + c
})
```
Here we defined all our computations in a simplest possible form.
For a example we just said that `d` is `a + c`. We didn't say that
to compute `d` you should call method `a()` then `c()` and concatenate
their results. Such simplicity give us many prizes:

  1. Any function can become async without breaking things
  2. We can automatically cache results and not execute
  computation multiple times
  3. We can easily switch between sequental and parallel execution
  depending on what is more appropriate for the task in hand.

This project implements control flow showed in the above example.

## Usage

```javascript
var flow = require('make-flow')
var fn = flow()

fn.def('a', function() {
  return 'a'
})

fn.def('b', function() {
  return 'b'
})

fn.def('c', function(a, b) {
  return a + b
})

fn.eval('c', function(err, c) {
  c.should.equal('ab')
})
```

The `.def` method defines what is called a task.
Once the task and all it's dependencies were defined we can evaluate it with `.eval()`

Task may be async:

```javascript
fn.def('config', function(done) {
 fs.readFile('config.json', done)
})
```

So `done` is a special case name meaning node style callback.

You can also define dependencies explicitly:

```javascript
fn.def('c', ['a', 'b'], function(a, b) {
  return a + b
})
```

All computation results are stored as the properties of the flow object, so the following
is true:

```javascript
fn.foo = 'foo'
fn.eval('foo', function (err, foo) {
  foo.should.equal('foo')
})
```

As you can see `.eval()` clobbers object on which it is called and subsequent evals
do not trigger computations.

But we can reuse our definitions!

```javascript
var json = flow()
.def('json', function(filename, done) {
  fs.readFile('config.json', done)
})
.def('object', function(json) {
  return JSON.stringify(json)
})

function readJson(name, cb) {
  json
  .run() // just Object.create(this) actually
  .set('filename', name) // the same as this.filename = name
  .eval('object', cb)
}
```

Creating such functions is what `make-flow` where designed for.
There is `.fn()` method which facilitates their creation a bit:

```javascript
var readJson = flow()
.def('json', function(filename, done) {
  fs.readFile('config.json', done)
})
.def('object', function(json) {
  return JSON.stringify(json)
})
.fn(function (name, cb) {
  this.filename = name
  this.eval('object', cb)
})
```

### Layers

We can also link computations from various runtime layers:

```javascript
var app = flow()
app.layer('app') // mark current instance to be app level
app.at('app', function () {
  app.def('config', function (done) {
    readJson('config.json', done)
  })
  app.def('db', function (config) {
    return require('monk')(config.connection_string)
  })
})
app.def('session', function (db, req, done) {
  db.loadSession(req.cookie.session, done)
})
app.def('user', function (db, session, done) {
  db.loadUser(session.username, done)
})
// ...
http.createServer(function (req, res) {
  app
  .run()
  .layer('request')
  .set('req', req)
  .set('res', res)
  .eval('some task')
})
```

In the above example `config` and `db` will be evaluated only once,
not for each incoming request.

Another way to attach a task to a certain level is:

```javascript
app.def('level', 'name', fn)
```

### Error handling

All error objects returned from `.eval` have `._task` and `._stack` properties:

``` javascript
flow().def('foo', function() {
  throw new Error('ups')
}).eval('foo', function(err) {
  err._task.should.equal('foo')
  err._stack.should.equal('foo')
})

flow().def('bar', function(done) {
  flow().def('baz', function() {throw new Error('ups')})
    .eval('baz', done)
}).eval('bar', function(err) {
  err._task.should.equal('bar')
  err._stack.should.equal('bar.baz')
})
```

### Control flow

Everything is executed sequentially.

## Installation

Via npm

```
npm install make-flow
```

As a component

```
component install eldargab/make-flow
```

## Related

[easy-app](https://github.com/eldargab/easy-app) is a simple and powerful
container with the same core ideas.

## License

MIT
