describe('forced colours', () => {
    it('runs with forced colours active', () => {
        expect(matchMedia('(forced-colors: active)').matches).toBe(true)
    })
})
