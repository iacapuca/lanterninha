import { describe, expect, it, vi } from 'vitest'
import { extractJson, velox } from '~/server/programme/velox/api.server'

describe('extractJson', () => {
  it('reads the literal after a variable, ignoring brackets inside strings', () => {
    const html = `<script>var x = 1; var eventsData = [{"t":"Sala ] 2","n":[1,2]},{"t":"\\"quoted\\" [x]"}];\nvar other = {};</script>`
    expect(extractJson(html, 'var eventsData =')).toEqual([{ t: 'Sala ] 2', n: [1, 2] }, { t: '"quoted" [x]' }])
  })

  it('fails loudly when the page changed', () => {
    expect(() => extractJson('<html></html>', 'var eventsData =')).toThrow('not found')
    expect(() => extractJson('var eventsData = [1, 2', 'var eventsData =')).toThrow('unbalanced')
  })
})

describe('velox.cities', () => {
  it('parses the embedded city list and drops placeholders', async () => {
    const data = [
      {
        stateCod: 'PE',
        stateName: 'Pernambuco',
        cities: [
          { cityCod: '0', cityName: 'Selecione', cityNameNorm: 'Selecione' },
          { cityCod: '1', cityName: 'Recife', cityNameNorm: 'Recife' },
        ],
      },
      { stateCod: 'BA' /* malformed cities: defaults to [] */ },
    ]
    vi.stubGlobal(
      'fetch',
      async () => new Response(`<script>MainData.Header.citiesData=${JSON.stringify(data)};</script>`),
    )
    const states = await velox.cities()
    expect(states).toEqual([
      {
        stateCod: 'PE',
        stateName: 'Pernambuco',
        cities: [{ cityCod: '1', cityName: 'Recife', cityNameNorm: 'Recife' }],
      },
      { stateCod: 'BA', cities: [] },
    ])
  })
})
