import rule41 from '../test/fixtures/contract/41/rule-enrollments.json'
import rule42 from '../test/fixtures/contract/42/rule-enrollments.json'
import rule43 from '../test/fixtures/contract/43/rule-enrollments.json'
import { RMNCH } from '../test/rmnch'
import type { ProgramRulesClient } from './client'
import { fetchRuleEnrollments } from './enrollment'

const FIXTURES = { '41': rule41, '42': rule42, '43': rule43 }

const answeringWith: (
    body: (typeof FIXTURES)[keyof typeof FIXTURES]
) => ProgramRulesClient = (body) => ({
    query: async (_query, schema) => schema.parse({ enrollments: body }),
})

describe('fetchRuleEnrollments reads the list each supported server sends', () => {
    it.each(Object.entries(FIXTURES))('DHIS2 2.%s', async (_version, body) => {
        const ids = body.enrollments.map((enrollment) => enrollment.enrollment)
        const result = await fetchRuleEnrollments(
            answeringWith(body),
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
