import { describe, expect, it } from 'vitest'
import { hivProgram } from '../__tests__/fixtures/program'
import { describeProblem } from './describeProblem'
import { buildProgramModel } from './programModel'

const model = buildProgramModel(hivProgram)
const searchable =
    'Searchable: ART number (`artNumber`, unique), First name (`firstName`), Date of birth (`dob`), Sex (`sex`), Weight (`weight`), Last visit (`visit`).'

describe('describeProblem', () => {
    it('names the program and lists its searchable attributes', () => {
        expect(
            describeProblem(model, { kind: 'not-searchable', attribute: 'xyz' })
        ).toBe(
            "`xyz` isn't searchable in HIV Program. Searchable: ART number (`artNumber`, unique), First name (`firstName`), Date of birth (`dob`), Sex (`sex`), Weight (`weight`), Last visit (`visit`). This program needs 2 details unless an ID is used."
        )
    })

    it('names the minimum when a form can never search', () => {
        const message = describeProblem(model, { kind: 'form-cannot-search' })
        expect(message).toContain('HIV Program')
        expect(message).toContain(searchable)
        expect(message).toContain('needs 2 details')
    })

    it('says "1 detail" when the minimum is 0 or 1', () => {
        const lenient = buildProgramModel({
            ...hivProgram,
            minAttributesRequiredToSearch: 0,
        })
        expect(
            describeProblem(lenient, { kind: 'form-cannot-search' })
        ).toContain('This program needs 1 detail unless an ID is used.')
    })

    it.each([
        'unknown-attribute',
        'unsupported-type',
        'operators-blocked',
        'range-not-supported',
        'shape-conflict',
    ] as const)('explains %s with the attribute and the program', (kind) => {
        const message = describeProblem(model, { kind, attribute: 'photo' })
        expect(message).toContain('`photo`')
        expect(message).toContain('HIV Program')
        expect(message).toContain(searchable)
    })
})
