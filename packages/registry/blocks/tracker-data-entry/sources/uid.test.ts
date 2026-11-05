import { generateUid } from './uid'

test('device-made ids are DHIS2 ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateUid))
    expect(ids.size).toBe(1000)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z][A-Za-z0-9]{10}$/)
})
