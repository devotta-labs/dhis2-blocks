import {
    parseEventFormDemoUrlState,
    serializeEventFormDemoUrlState,
    withEnrollment,
    withForm,
    withOrgUnit,
    withProgram,
    withStage,
    withoutForm,
} from './demoUrlState'

const parse = (query: string) =>
    parseEventFormDemoUrlState(new URLSearchParams(query))

describe('event form demo URL state', () => {
    it('round-trips the context, the stage and an open event', () => {
        const state = {
            programId: 'WSGAb5XwJ3Y',
            orgUnitId: 'm7fBMpmVpSM',
            enrollmentId: 'PE6abx7Zhn0',
            programStageId: 'WZbXY0S00lP',
            eventId: 'Evahwp3zrQ4',
            view: 'form',
        } as const

        expect(parse(serializeEventFormDemoUrlState(state))).toEqual(state)
    })

    it('ignores unknown keys and falls back to an empty context on a bad view', () => {
        expect(parse('programId=WSGAb5XwJ3Y&token=secret')).toEqual({
            programId: 'WSGAb5XwJ3Y',
        })
        expect(parse('programId=WSGAb5XwJ3Y&view=list')).toEqual({})
    })

    it('opens a form only when it has a stage, and an event id only in a form', () => {
        expect(parse('programId=P&view=form')).toEqual({
            programId: 'P',
            programStageId: undefined,
        })
        expect(parse('programId=P&programStageId=S&eventId=E')).toEqual({
            programId: 'P',
            programStageId: 'S',
            eventId: undefined,
        })
    })

    it('drops what was chosen under a changed selection', () => {
        const state = {
            programId: 'P',
            orgUnitId: 'O',
            enrollmentId: 'N',
            programStageId: 'S',
        }

        expect(withProgram(state, 'Q')).toEqual({
            programId: 'Q',
            orgUnitId: 'O',
        })
        expect(withOrgUnit(state, 'R')).toEqual({
            programId: 'P',
            orgUnitId: 'R',
        })
        expect(withEnrollment(state, 'M')).toEqual({
            ...state,
            enrollmentId: 'M',
        })
        expect(withStage(state, 'T')).toEqual({ ...state, programStageId: 'T' })
    })

    it('opens and closes the form on the same stage', () => {
        const opened = withForm(
            { programId: 'P', orgUnitId: 'O', enrollmentId: 'N' },
            { programStageId: 'S', eventId: 'E', enrollmentId: 'M' }
        )

        expect(opened).toEqual({
            programId: 'P',
            orgUnitId: 'O',
            enrollmentId: 'M',
            programStageId: 'S',
            eventId: 'E',
            view: 'form',
        })
        expect(withoutForm(opened)).toEqual({
            programId: 'P',
            orgUnitId: 'O',
            enrollmentId: 'M',
            programStageId: 'S',
        })
    })
})
