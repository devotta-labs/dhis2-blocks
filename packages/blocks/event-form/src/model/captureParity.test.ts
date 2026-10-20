/*
 * Does this form end up where DHIS2 Capture ends up for the same event? `oursView` runs the
 * program-rules lib twice with the overlay in between, as `useEventFormModel` does, and builds the
 * form model; `captureSettled` re-implements Capture's effect processing and repeats its rules run
 * until it stops writing values. See `__fixtures__/capture.ts` for what is taken from Capture, and
 * `captureParity.differences.test.ts` for where the two differ.
 */
import { rule } from '../../../program-rules/test/metadata'
import { RMNCH } from '../../../program-rules/test/rmnch'
import { dataElement } from './__fixtures__/builders'
import {
    captureSettled,
    oursView,
    type ParityScenario,
} from './__fixtures__/capture'
import {
    assign,
    expectParity,
    hide,
    largeEvent,
    largeScenario,
    rmnch,
    RMNCH_FIELDS,
    synthetic,
    visit,
    YES_NO,
} from './captureParityTestSupport'

describe('the same outcome as Capture', () => {
    it('RMNCH, the stored visit: Chronic conditions No hides six follow-ups that hold answers, and clearing them hides two more fields', () => {
        // Pass 1 hides the follow-ups; pass 2 reads them empty, so `!#{autoimmunedisease}`
        // and `!#{otherchronicconditionexists}` turn true and hide the aspirin field and the
        // "other chronic condition specified" field. Capture gets there over two runs.
        const view = oursView(rmnch, visit())
        expect(view.visible).not.toContain(RMNCH_FIELDS.aspirin)
        expect(view.visible).not.toContain(RMNCH_FIELDS.otherChronicSpecified)
        expect(view.values[RMNCH_FIELDS.autoimmune]).toBeUndefined()
        expectParity(rmnch, visit())
    })

    it('RMNCH, Chronic conditions Yes', () => {
        expectParity(rmnch, visit({ [RMNCH.chronic]: 'true' }))
    })

    it('RMNCH, an LMP assigns the gestational age', () => {
        const stored = visit({ [RMNCH.lmp]: '2026-01-01' })
        expect(oursView(rmnch, stored).values[RMNCH.gestationalAge]).toBe('10')
        expectParity(rmnch, stored)
    })

    it('RMNCH, an LMP after the visit shows the rule error', () => {
        expectParity(rmnch, visit({ [RMNCH.lmp]: '2026-04-01' }))
    })

    it('RMNCH, a clinical due date close to the LMP warns on both fields', () => {
        expectParity(
            rmnch,
            visit({
                [RMNCH.lmp]: '2026-01-01',
                [RMNCH_FIELDS.clinicalDueDate]: '2026-03-01',
            })
        )
    })

    it('RMNCH, DATAELEMENT_NEWEST_EVENT_PROGRAM: Smoking No on this visit is outvoted by a newer visit', () => {
        // `smoking` reads the newest event with a value. Later visits say Yes, so the smoking
        // cessation field stays, in both.
        const stored = visit({
            [RMNCH_FIELDS.smoking]: 'false',
            [RMNCH_FIELDS.smokingCessation]: 'true',
        })
        expect(oursView(rmnch, stored).visible).toContain(
            RMNCH_FIELDS.smokingCessation
        )
        expectParity(rmnch, stored)
    })

    it('RMNCH, DATAELEMENT_NEWEST_EVENT_PROGRAM: on the newest visit Smoking No hides and clears smoking cessation', () => {
        const newest: ParityScenario = {
            ...rmnch,
            input: {
                ...rmnch.input,
                event: { ...rmnch.input.event, occurredAt: '2026-12-01' },
            },
        }
        const stored = visit({
            [RMNCH_FIELDS.smoking]: 'false',
            [RMNCH_FIELDS.smokingCessation]: 'true',
        })
        expect(oursView(newest, stored).visible).not.toContain(
            RMNCH_FIELDS.smokingCessation
        )
        expectParity(newest, stored)
    })

    it('an ASSIGN read by a rule that runs before it (priority) lands one pass later', () => {
        const scenario = synthetic([
            rule('reads', "#{b} == 'ready'", [hide('C')], { priority: 1 }),
            rule('writes', "d2:hasValue('a')", [assign('B', "'ready'")], {
                priority: 2,
            }),
        ])
        expect(oursView(scenario, { A: 'a', C: 'c' }).visible).not.toContain(
            'C'
        )
        expectParity(scenario, { A: 'a', C: 'c' })
    })

    it('a hidden section hides its fields and keeps their values', () => {
        const scenario = synthetic(
            [
                rule('r', 'true', [
                    { id: 'hs', type: 'HIDESECTION', sectionId: 'second' },
                ]),
            ],
            [
                dataElement('A'),
                dataElement('B'),
                dataElement('X', { compulsory: true }),
            ],
            [
                { id: 'first', name: 'First', dataElementIds: ['A'] },
                { id: 'second', name: 'Second', dataElementIds: ['B', 'X'] },
            ]
        )
        expectParity(scenario, { A: 'a', B: 'b', X: 'x' })
    })

    it('option groups and hidden options filter the same options', () => {
        const scenario = synthetic(
            [
                rule('r', 'true', [
                    {
                        id: 'show',
                        type: 'SHOWOPTIONGROUP',
                        dataElementId: 'X',
                        optionGroup: { id: 'g1', optionCodes: ['yes', 'no'] },
                    },
                    {
                        id: 'hide',
                        type: 'HIDEOPTION',
                        dataElementId: 'X',
                        option: { id: 'o-no', code: 'no' },
                    },
                ]),
            ],
            [dataElement('X', { options: YES_NO })]
        )
        expect(oursView(scenario, {}).options).toEqual({ X: ['yes'] })
        expectParity(scenario, {})
    })

    it('a warning on a hidden field shows nowhere', () => {
        const scenario = synthetic([
            rule('r', 'true', [
                hide('X'),
                {
                    id: 'w',
                    type: 'SHOWWARNING',
                    dataElementId: 'X',
                    content: 'X looks odd',
                },
            ]),
        ])
        expectParity(scenario, { A: 'a' })
    })

    it('the large generated program, its stored event (older than the others)', () => {
        // Its variables read the newest event with a value, and every other event is newer, so
        // rules see the other events' values. Rule errors on hidden fields differ (see below).
        const scenario = largeScenario()
        const stored = largeEvent.dataValues
        const ours = oursView(scenario, stored)
        expect(ours).toEqual({
            ...captureSettled(scenario, stored),
            hiddenFieldMessages: ours.hiddenFieldMessages,
        })
    })
})
