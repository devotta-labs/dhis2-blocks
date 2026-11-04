import { fetchCustomRuleMetadata, fetchCustomRulePersons } from './customContext'
import type { ProgramRulesClient } from './client'
import type { RuleEnrollmentData } from '../lib'

const enrollment = (id: string) => ({ enrollment: id, enrolledAt: '2026-01-01', status: 'ACTIVE', orgUnit: 'ou', attributes: [], events: [{ event: `event-${id}`, programStage: 'lab', status: 'COMPLETED', occurredAt: '2026-01-01', orgUnit: 'ou', dataValues: [{ dataElement: 'result', value: '6.1' }], customField: 'preserved' }] })
const persons = new Map<string, RuleEnrollmentData>(['one', 'two'].map((id) => [id, { trackedEntityId: 'person', enrollment: { id, enrolledAt: '2026-01-01', orgUnitId: 'ou', attributes: {} }, events: [] }]))

describe('complete custom context', () => {
    it('deduplicates tracked entities and preserves raw data alongside normalized events', async () => {
        const queries: Parameters<ProgramRulesClient['query']>[0][] = []
        const client: ProgramRulesClient = { query: async (query, schema) => {
            queries.push(query)
            return schema.parse({ trackedEntity: { trackedEntity: 'person', attributes: [{ attribute: 'name', value: 'Example' }], enrollments: [enrollment('one'), enrollment('two')], relationships: [{ id: 'relationship' }] } })
        } }
        const result = await fetchCustomRulePersons(client, persons)
        expect(queries).toHaveLength(1)
        expect(queries[0]?.trackedEntity?.id).toBe('person')
        expect(queries[0]?.trackedEntity?.params).not.toHaveProperty('program')
        expect(result.get('one')?.customData?.events).toHaveLength(2)
        expect(result.get('two')?.customData?.trackedEntity?.attributes.name).toBe('Example')
        expect(result.get('one')?.customData?.trackedEntity?.data).toMatchObject({ relationships: [{ id: 'relationship' }], enrollments: [{ events: [{ customField: 'preserved' }] }, {}] })
    })
    it('fails rather than treating inaccessible history as empty history', async () => {
        const client: ProgramRulesClient = { query: async () => { throw new Error('Forbidden') } }
        await expect(fetchCustomRulePersons(client, persons)).rejects.toThrow('Forbidden')
    })
    it('requires a tracked entity for tracker custom functions', async () => {
        const client: ProgramRulesClient = { query: async (query, schema) => schema.parse(query) }
        const missing = new Map([...persons].map(([id, person]) => [id, { ...person, trackedEntityId: undefined }]))
        await expect(fetchCustomRulePersons(client, missing)).rejects.toThrow('tracked entity')
    })
    it('requests expanded program metadata', async () => {
        const client: ProgramRulesClient = { query: async (query, schema) => {
            expect(query.program?.params?.fields).toContain('dataElement[*]')
            return schema.parse({ program: { id: 'program', translations: [], programStages: [{ id: 'lab' }] } })
        } }
        expect(await fetchCustomRuleMetadata(client, 'program')).toHaveProperty('programStages')
    })
})
