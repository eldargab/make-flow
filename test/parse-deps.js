var parse = require('../lib/parse-deps')

describe('Parse deps', function () {
  it('Should parse deps of named function', function () {
    parse(function hello (req, res, next) {})
      .should.eql(['req', 'res', 'next'])
  })

  it('Should parse deps of anonymus function', function () {
    parse(function(hello, world){})
      .should.eql(['hello', 'world'])
  })

  it('Should ignore comments', function () {
    parse(function (
      a, //, b, c
      /* e, f, */
      d
    ) {}).should.eql(['a', 'd'])
  })

  it('Should return empty array if there is no deps', function () {
    parse(function () {}).should.eql([])
  })

  it('Should not parse nested things', function () {
    parse(function () {
      function hello (a, b) {
      }
    }).should.eql([])
  })
})
