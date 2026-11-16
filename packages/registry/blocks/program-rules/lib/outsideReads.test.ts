import * as engine from '@dhis2/rule-engine'
import { rmnchInput, rmnchMetadata } from '../__tests__/rmnch'
import { buildRuleContext } from './buildContext'
import { outsideReads } from './outsideReads'

const BORN = 'gHGyrwKPzej'
const SMOKING = 'sWoqcoByYmD'
const OUTCOME = 'V5PR8Kw8ZnC'

const reads = () => {
    const metadata = rmnchMetadata()
    const context = buildRuleContext(engine, {
        ...metadata,
        variables: metadata.variables.map((variable) =>
            variable.attributeId === BORN
                ? { ...variable, fieldName: 'Birth date' }
                : variable
        ),
    })
    return outsideReads(context, rmnchInput())
}

describe('outsideReads', () => {
    it('reads an attribute from the enrolment, by its name', () => {
        expect(reads().get(BORN)).toEqual({
            label: 'Birth date',
            value: '1991-01-18',
            valueType: 'DATE',
            options: undefined,
            variable: expect.any(String),
            from: { kind: 'enrollment' },
        })
    })

    it('reads a data element from the newest event that has it, and says its stage', () => {
        expect(reads().get(SMOKING)).toMatchObject({
            label: 'smoking',
            value: 'true',
            valueType: 'BOOLEAN',
            from: { kind: 'event', stage: 'Care at birth' },
        })
    })

    it('names the variable’s stage when no event of it has a value', () => {
        const outcome = reads().get(OUTCOME)
        expect(outcome?.value).toBeUndefined()
        expect(outcome?.from).toEqual({ kind: 'event', stage: 'Care at birth' })
    })

    it('reads a previous-event variable from the events before this one', () => {
        const metadata = rmnchMetadata()
        const context = buildRuleContext(engine, {
            ...metadata,
            variables: metadata.variables.map((variable) =>
                variable.dataElementId === SMOKING
                    ? { ...variable, sourceType: 'DATAELEMENT_PREVIOUS_EVENT' }
                    : variable
            ),
        })
        const input = rmnchInput()
        const later = {
            ...input,
            event: { ...input.event, occurredAt: '2026-05-01' },
        }
        // The newest event before 1 May is the second visit of 18 April.
        expect(outsideReads(context, later).get(SMOKING)).toMatchObject({
            value: 'false',
            from: {
                kind: 'event',
                stage: 'Second antenatal care visit',
                previous: true,
            },
        })
    })
})
