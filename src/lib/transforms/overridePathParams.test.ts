import { overridePathParams } from './overridePathParams'

describe('overridePathParams()', () => {
  it('should replace value of path param with a {{namedId}} variable', () => {
    const obj = {
      item: [
        {
          name: 'Monkeys',
          item: [
            {
              request: {
                url: {
                  path: ['crm', 'monkies', ':id'],
                  variable: [
                    {
                      disabled: false,
                      type: 'any',
                      value: '<string>',
                      key: 'id',
                      description: '(Required) ID of the monkey you are acting upon.'
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }

    const transform = overridePathParams(obj)
    expect(transform).toMatchSnapshot()
  })

  it('should only targets id for now', () => {
    const obj = {
      item: [
        {
          name: 'Monkeys',
          item: [
            {
              request: {
                url: {
                  path: ['crm', 'monkies', ':id', ':foo'],
                  variable: [
                    {
                      disabled: false,
                      type: 'any',
                      value: '<string>',
                      key: 'id',
                      description: '(Required) ID of the monkey you are acting upon.'
                    },
                    {
                      disabled: false,
                      type: 'any',
                      value: '<string>',
                      key: 'foo',
                      description: '(Required) Foo of the monkey you are acting upon.'
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }

    const transform = overridePathParams(obj)
    expect(transform).toMatchSnapshot()
  })
})
