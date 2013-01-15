# make-flow

This utility suggests control flow ideal for a particular but quite common use case
were your computation has to deal with lots of interdependent intermediate values.
For example:

```javascript
var Flow = require('make-flow')

var flow = Flow()
.def('a', function () {
  return 'a'
})
.def('b', function (a) {
  return a + 'b'
})
.def('ab', function (a, b) {
  return a + b
})
```

Above we have a definition of `ab` computation. It's ideal. There is no accidental
complexity, nothing we can cut off. It describes `what` without
messing it with `how`. That's why asynchrony breaks nothing:

```javascript
flow.def('a', function (done) { // `done` is a special case name meaning node style callback
  setTimeout(function () {
    done(null, 'a')
  })
})
```

## Usage

Evaluate `ab`:

``` javascript
flow.eval('ab', function (err, ab) {
})
```

Seeding with input:

```javascript
flow
.run() // create next level instance to avoid clobbering of original definition
.set('a', 'a') // seed with already evaluated value
.eval('ab', cb)
```

### Layers

Sometimes our computations have to deal with values from several runtime levels.
That's how `make-flow` can do it:

```javascript
var fn = Flow()
.layer('app') // mark current instance to be app level
.at('app', function (app) { // everything here should be bound to app level instance
  app
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

Another way to attach a value to a certain level is:

```javascript
flow.def('level', 'name', fn)
```

### Error handling

All error objects returned from `.eval` have `._task` and `._stack` properties:

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
container for substantial applications with the same core ideas.

## License

MIT
