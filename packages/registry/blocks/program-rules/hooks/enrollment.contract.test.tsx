import rule41 from '../__tests__/fixtures/contract/41/rule-enrollments.json'
import rule42 from '../__tests__/fixtures/contract/42/rule-enrollments.json'
import rule43 from '../__tests__/fixtures/contract/43/rule-enrollments.json'
import { RMNCH } from '../__tests__/rmnch'
import { engineOver } from '../__tests__/serve'
import { fetchRuleEnrollments } from './enrollment'

/** The `enrollments` list body each supported server answers the block's request with, trimmed. */
const FIXTURES = { '41': rule41, '42': rule42, '43': rule43 }

describe('fetchRuleEnrollments reads the list each supported server sends', () => {
    it.each(Object.entries(FIXTURES))('DHIS2 2.%s', async (_version, body) => {
        const engine = await engineOver({
            'tracker/enrollments': async () => body,
        })
        const ids = body.enrollments.map((enrollment) => enrollment.enrollment)
        const result = await fetchRuleEnrollments(
            engine,
            RMNCH.programId,
            ids,
            true
        )
        expect([...result.keys()]).toEqual(ids)
        expect(result.get(ids[0]!)?.events).toHaveLength(
            body.enrollments[0]!.events.length
        )
    })
})
