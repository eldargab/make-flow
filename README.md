# make-flow

If your function has to read many things before it can produce something useful consider to factor it as follows

``` javascript
var Flow = require('make-flow')
var fn = Flow()
.def('config_json', function (done) {
  fs.readFile('config.json', 'utf8', done)
})
.def('cfg', function (config_json) {
  return JSON.parse(config_json)
})
.def('db', function (cfg) {
  return new Db(cfg.connectionString)
})
.def('user', function (db, cfg, done) {
  db.getUser(cfg.user, done)
})
.def('editor', function (db, page, done) {
  db.getPageEditor(page, done)
})
.def('canEdit', function (editor, user) {
  return editor.id == user.id
})

function canEdit (page, cb) {
  fn.run().set('page', page).eval('canEdit', cb)
}
```

## Details

`.def()` method defines a task

``` javascript
fn.def('foo', function () {
  return 'bar'
})
```
Once defined it can be evaluated

``` javascript
fn.eval('foo', function (err, val) {
  val.should.equal('bar')
})
```

The result of `foo` is cached as `fn.foo`.

``` javascript
fn.foo.should.equal('bar')
```

By assigning a value to some `fn` property you kinda seeding it with an input as it was the case with `page` from `canEdit()` function:

``` javascript
fn.page = 'index.jade'
// or alternatively
fn.set('page', 'index.jade') // doesn't break fluent api
// in both cases
fn.eval('page', function (err, page) {
  page.should.equal('index.jade')
})
```

All task dependencies are resolved properly. It is safe to call `.eval` for any task at any time as long as there is no side effects.

There is a special `done` dependency which designates node style async callback.

``` javascript
fn.def('bar', function (done) { // task is async
  setTimeout(function () {
    done(null, 'foo')
  })
})
```

### Layers

Layers are the most cool feature of this lib. Because tasks and their values are just properties of normal object we can do

``` javascript
Object.create(fn).set('some input', 'foo').eval('bar', cb)
// Instead of Object.create(fn) it's better to do fn.run()
```
and have all job done with original `fn` left unclobbered. We can push this concept even further. Returning back to our very first example, we can notice that we probably don't want to re-evaluate config, db, etc each time. They are kinda app level things. Fortunately we can achieve desired behaviour at no cost:

``` javascript
fn.def('app', 'config_json', function (done) { // mark a task been "app" level
  fs.readFile('config.json', 'utf8', done)
})
...
fn.layer('app') // mark fn been an "app" level instance
```
That's it.

Generally the following is true

``` javascript
var req
var app = Flow().layer('app')
.def('app', 'foo', function () {
  this.should.equal(app)
  return 'foo'
})
.def('req', 'bar', function () {
  this.should.equal(req)
  return 'bar'
})
.def('foobar', function (foo, bar) {
  return foo + bar
})

req = app.run().layer('req')
req.run().eval('foobar')

req.__proto__.should.equal(app)
req.hasOwnProperty('bar').should.be.true
req.hasOwnProperty('foo').should.be.false
app.hasOwnProperty('foo').should.be.true
app.hasOwnProperty('bar').should.be.false
```

When we have more than one task at particular layer it's better to use `.at()`

``` javascript
fn.at('app', function (fn) {
  fn.def('foo', function () {})
})
```

### Error handling

All error objects returned to `.eval` have `._task` and `._stack` properties:

``` javascript
Flow().def('foo', function () {
  throw new Error('ups')
}).eval('foo', function (err) {
  err._task.should.equal('foo')
  err._stack.should.equal('foo')
})

Flow().def('bar', function (done) {
  Flow.def('baz', function () {throw new Error('ups')})
    .eval('baz', done)
}).eval('bar', function (err) {
  err._task.should.equal('bar')
  err._stack.should.equal('bar.baz')
})
```

### Control flow

All tasks are executed sequentially one after another. Traditional control flow with manual ordering while not appriciated also not discouraged.

## Installation

Via npm

```
npm install make-flow
```

## License

MIT
