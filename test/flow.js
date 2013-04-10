var should = require('should')
var Log = require('test-log')
var Flow = require('..')

describe('make-flow', function() {
  var app, log

  beforeEach(function() {
    app = new Flow
    log = Log()
  })

  describe('Constructor', function() {
    it('Should work as a factory', function() {
      Flow().should.be.an.instanceOf(Flow)
    })
  })

  describe('.eval(task, [cb])', function() {
    it('Should call task function', function(done) {
      app.def('foo', function() {
        return 'bar'
      })
      app.eval('foo', function(err, val) {
        val.should.equal('bar')
        done()
      })
    })

    it('Should treat task with `done` argument as async', function(done) {
      var end
      app.def('foo', function(done) {
        end = done
      })
      app.eval('foo', function(err, val) {
        val.should.equal('ok')
        done()
      })
      end(null, 'ok')
    })

    it('Should call task with `this` set to app', function(done) {
      app.def('foo', function() {
        this.should.equal(app)
        done()
      }).eval('foo')
    })

   it('Should pass task arguments', function(done) {
      app
        .def('foo', function() {
          return 'foo'
        })
        .def('bar', function() {
          return 'bar'
        })
        .def('foobar', function(foo, bar) {
          foo.should.equal('foo')
          bar.should.equal('bar')
          done()
        })
        .eval('foobar')
    })

    it('Should not evaluate task twice', function() {
      app.def('foo', function() {
        log('foo')
      })
      app.eval('foo')
      log.should.equal('foo')
      app.eval('foo')
      log.should.equal('foo')
    })

    it('Should support multiple simultaneous eval requests', function() {
      var fooDone

      app.def('foo', function(done) {
        log('foo')
        fooDone = done
      })

      app.eval('foo', function() {
        log('first')
      })

      app.eval('foo', function() {
        log('second')
      })

      fooDone()

      log.should.equal('foo first second')
    })

    it('Should evaluate all task dependencies before evaluating task itself', function() {
      var b_end, c_end, d_end

      app
        .def('a', function(b, c, d) {
          log('a')
        })
        .def('b', function(c, done) {
          log('b')
          b_end = done
        })
        .def('c', function(done) {
          log('c')
          c_end = done
        })
        .def('d', function(done) {
          log('d')
          d_end = done
        })
        .eval('a', function() {
          log('done')
        })

      log.should.equal('c')
      c_end()
      log.should.equal('c b')
      b_end()
      log.should.equal('c b d')
      d_end()
      log.should.equal('c b d a done')
    })

    it('Should return error if task is not defined', function(done) {
      app.eval('bar', function(err) {
        err.message.should.match(/bar/)
        err.message.should.match(/not defined/)
        done()
      })
    })
  })

  describe('.get(task)', function() {
    it('Should return task value', function() {
      app.def('a', function() {
        return 'b'
      })
      should.not.exist(app.get('a'))
      app.eval('a')
      app.get('a').should.equal('b')
    })
  })

  describe('.set(task, val)', function() {
    it('Should set task value', function() {
      app.set('a', 'b').get('a').should.equal('b')
    })
  })

  describe('.run()', function() {
    it('Should create new instance with everything been inherited', function() {
      app.def('foo', function() {
        return 'bar'
      })
      var New = app.run()
      New.eval('foo')
      New.get('foo').should.equal('bar')
      should.not.exist(app.get('foo'))
    })
  })

  describe('.fn(fn)', function() {
    it('Should create a "main" function', function(done) {
      var fn = app
      .def('a', function() {
        return 'a'
      })
      .def('ab', function(a, b) {
        return a + b
      })
      .fn(function(b, cb) {
        this.set('b', b)
        this.eval('ab', cb)
      })

      fn('b', function(err, ab) {
        ab.should.equal('ab')
        should.not.exist(app.get('ab'))
        done()
      })
    })
  })

  describe('Layers', function() {
    it('Task should be bound to its layer', function() {
      app
        .layer('app')
        .def('app', 'setup', function() {
          return 'setup'
        })
        .def('request', 'user', function() {
          return 'user'
        })
        .def('response', function(user, setup) {
          return user + setup
        })

      var req = app.run().layer('request')

      req.eval('response')

      req.get('response').should.equal('usersetup')
      req.get('user').should.equal('user')
      req.get('setup').should.equal('setup')

      app.get('setup').should.equal('setup')
      should.not.exist(app.get('user'))
      should.not.exist(app.get('response'))
    })

    describe('.at(layer, fn)', function() {
      it('Should bound all tasks to `layer`', function() {
        app.at('app', function(fn) {
          fn.def('foo', function() {
            return 'foo'
          })
        })
        app.layer('app')
        app.run().eval('foo')
        app.get('foo').should.equal('foo')
      })

      it('Should not clobber layer specified explicitly', function() {
        app.at('app', function(fn) {
          fn.def('req', 'foo', function() {
            return 'foo'
          })
        })
        app.layer('app')
        var req = app.run().layer('req')
        req.run().eval('foo')
        should.not.exist(app.get('foo'))
        req.get('foo').should.equal('foo')
      })

      it('Should return `this`', function() {
        app.at('foo', function() {}).should.equal(app)
      })
    })
  })

  describe('Error handling', function() {
    it('Should catch task exceptions', function(done) {
      app.def('hello', function() {
        throw new Error('hello error')
      })
      app.eval('hello', function(err) {
        err.message.should.equal('hello error')
        done()
      })
    })

    it('Should catch async errors', function(done) {
      app.def('foo', function(done) {
        done(new Error('foo error'))
      }).eval('foo', function(err) {
        err.message.should.equal('foo error')
        done()
      })
    })

    describe('Error object', function() {
      it('Should always be an instance of Error', function(done) {
        app.def('foo', function() {
          throw 'foo'
        }).eval('foo', function(err) {
          err.should.be.an.instanceof(Error)
          err.orig.should.equal('foo')
          done()
        })
      })

      describe('._task', function() {
        describe('Should be a name of throwing task', function() {
          it('Dependency case', function(done) {
            app
            .def('foo', function() {
              throw new Error('error')
            })
            .def('bar', function(foo) {})
            .def('baz', function(foo) {})
            .eval('bar', function(err) {
              err._task.should.equal('foo')
              app.eval('baz', function(err) {
                err._task.should.equal('foo')
                done()
              })
            })
          })

          it('External error case', function(done) {
            app.def('foo', function() {
              var err = new Error('error')
              err._task = 'baz'
              throw err
            }).eval('foo', function(err) {
              err._task.should.equal('foo')
              done()
            })
          })
        })
      })

      describe('._stack', function() {
        describe('Should be a concatenation of previous value and throwing task', function() {
          it('no previous value', function(done) {
            app.def('foo', function() {
              throw new Error('hi')
            }).eval('foo', function(err) {
              err._stack.should.equal('foo')
              done()
            })
          })

          it('with previous value', function(done) {
            app.def('foo', function() {
              var err = new Error('hi')
              err._stack = 'baz'
              throw err
            }).eval('foo', function(err) {
              err._stack.should.equal('foo.baz')
              done()
            })
          })
        })
      })
    })
  })
})

