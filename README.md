# make-flow

Generally, callback hell problem arises when there is a bunch
of interdependent async computations. Rather then trying to emulate
sync control flow with verious funky utils we could be declarative
and specify not `HOW` to compute, but `WHAT` to compute. For example:

```javascript
def('a', function() {
  return 'a'
})

def('b', function(a) {
  return 'b'
})

def('ab', function(a, b) {
  return a + b
})
```
...


## Usage

TBD...

### Layers

`make-flow` also allows to link computations from various runtime layers:

```javascript
var app = Flow()
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
  .run() // create next level instance
  .layer('request')
  .set('req', req) // seed
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
Flow().def('foo', function() {
  throw new Error('ups')
}).eval('foo', function(err) {
  err._task.should.equal('foo')
  err._stack.should.equal('foo')
})

Flow().def('bar', function(done) {
  Flow().def('baz', function() {throw new Error('ups')})
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
