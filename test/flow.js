var should = require('should')
var Log = require('test-log')
var Flow = require('../lib/index')

describe('make-flow', function () {
  var flow, log

  beforeEach(function () {
    flow = new Flow
    log = Log()
  })

  describe('.eval(task, [cb])', function () {
    it('Should call task function', function (done) {
      flow.def('foo', function () {
        return 'bar'
      })
      flow.eval('foo', function (err, val) {
        val.should.equal('bar')
        done()
      })
    })

    it('Should treat task with <done> argument as async', function (done) {
      var end
      flow.def('foo', function (done) {
        end = done
      })
      flow.eval('foo', function (err, val) {
        val.should.equal('ok')
        done()
      })
      end(null, 'ok')
    })

    it('Should call callback with <this> set to <flow>', function () {
      flow.def('foo', function () {
        return 'bar'
      }).eval('foo', function () {
        this.should.equal(flow)
      })
    })

    it('Should call task with `this` set to flow', function (done) {
      flow.def('foo', function () {
        this.should.equal(flow)
        done()
      }).eval('foo')
    })

    it('Should store result in <this[task_name]>', function () {
      flow.def('a', function () {
        return 'b'
      })
      should.ok(flow.a === undefined)
      flow.eval('a')
      flow.a.should.equal('b')
    })

    it('Should set <this[task_name]> to <null> when the result is <undefined>', function () {
      flow.def('undefined', function () {}).eval('undefined')
      should.ok(flow['undefined'] === null)
    })

    it('Should not call task function when <this[task_name]> is not <undefined>', function (done) {
      flow.hello = 10
      flow.def('hello', log.fn('hello'))
      flow.eval('hello', function (err, hello) {
        hello.should.equal(10)
        log.should.be.empty
        done()
      })
    })

    it('Should evaluate all task dependencies before evaluating task itself', function () {
      var b_end, c_end, d_end

      flow
        .def('a', function (b, c, d) {
          log('a')
        })
        .def('b', function (c, done) {
          log('b')
          b_end = done
        })
        .def('c', function (done) {
          log('c')
          c_end = done
        })
        .def('d', function (done) {
          log('d')
          d_end = done
        })
        .eval('a', function () {
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

    it('Should call parent for unknown tasks', function (done) {
      var parent = new Flow
      parent.def('a', function () { return 'a' })
      flow.parent(parent).eval('a', function (err, val) {
        val.should.equal('a')
        done()
      })
    })
  })

  describe('.run()', function () {
    it('Should create new instance with everything been inherited', function () {
      flow.def('foo', function () {
        return 'bar'
      })
      var New = flow.run().eval('foo')
      New.foo.should.equal('bar')
      should.not.exist(flow.foo)
    })
  })

  describe('Error handling', function () {
    it('Should catch task exceptions', function (done) {
      flow.def('hello', function () {
        throw 'hello error'
      })
      flow.eval('hello', function (err) {
        err.should.equal('hello error')
        done()
      })
    })
  })
})

