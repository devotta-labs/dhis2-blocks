import { readLabState, writeLabState } from './labUrlState'

test('defaults round-trip to empty params', () => {
    const state = readLabState(new URLSearchParams())
    expect(state).toMatchObject({
        source: 'fixture',
        scenario: 'hubs',
        size: 300,
        cap: 500,
        layout: 'web',
    })
    expect(state.hops).toBeUndefined()
    expect(writeLabState(state).toString()).toBe('')
})

test('bad values fall back', () => {
    const state = readLabState(
        new URLSearchParams(
            'hops=abc&size=5&cap=99999&scenario=nope&layout=sideways&source=x'
        )
    )
    expect(state).toMatchObject({
        source: 'fixture',
        scenario: 'hubs',
        size: 10,
        cap: 2000,
        layout: 'web',
    })
    expect(state.hops).toBeUndefined()
    expect(readLabState(new URLSearchParams('hops=9')).hops).toBe(6)
})

test('live state keeps te', () => {
    const params = new URLSearchParams(
        'source=live&te=RvE2eTei010&layout=trace'
    )
    const state = readLabState(params)
    expect(state).toMatchObject({
        source: 'live',
        te: 'RvE2eTei010',
        layout: 'trace',
    })
    expect(writeLabState(state).toString()).toBe(
        'source=live&te=RvE2eTei010&layout=trace'
    )
})
