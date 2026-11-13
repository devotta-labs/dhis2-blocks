import byId41 from './__fixtures__/byId.41.json'
import byId42 from './__fixtures__/byId.42.json'
import byId43 from './__fixtures__/byId.43.json'
import leaf41 from './__fixtures__/leaf.41.json'
import leaf42 from './__fixtures__/leaf.42.json'
import leaf43 from './__fixtures__/leaf.43.json'
import me41 from './__fixtures__/me.41.json'
import me42 from './__fixtures__/me.42.json'
import me43 from './__fixtures__/me.43.json'
import search41 from './__fixtures__/search.41.json'
import search42 from './__fixtures__/search.42.json'
import search43 from './__fixtures__/search.43.json'
import { ByIdSchema, MeSchema, SearchSchema } from './schemas'

const versions = [
    { version: 41, me: me41, search: search41, byId: byId41, leaf: leaf41 },
    { version: 42, me: me42, search: search42, byId: byId42, leaf: leaf42 },
    { version: 43, me: me43, search: search43, byId: byId43, leaf: leaf43 },
]

describe.each(versions)(
    '2.$version responses',
    ({ me, search, byId, leaf }) => {
        it('parses me, marking a unit with children', () => {
            const parsed = MeSchema.parse(me)

            expect(parsed.userId).toBe(me.id)
            expect(parsed.assigned).toHaveLength(1)
            expect(parsed.assigned[0]?.hasChildren).toBe(true)
        })

        it('marks a facility as having no children', () => {
            const parsed = MeSchema.parse({
                id: 'u',
                organisationUnits: [leaf],
            })

            expect(parsed.assigned[0]?.hasChildren).toBe(false)
        })

        it('parses a search page', () => {
            const parsed = SearchSchema.parse(search)

            expect(parsed.clinics).toHaveLength(search.organisationUnits.length)
            expect(parsed.hasMore).toBe(false)
        })

        it('parses clinics by id', () => {
            expect(ByIdSchema.parse(byId)).toHaveLength(
                byId.organisationUnits.length
            )
        })
    }
)

describe('MeSchema', () => {
    it('reads a missing organisationUnits as none assigned', () => {
        expect(MeSchema.parse({ id: 'u' }).assigned).toEqual([])
    })
})
