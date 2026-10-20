/*
 * Where this form and DHIS2 Capture end up differently for the same event, with who is right.
 * Each case is `it.fails`: it asserts parity and is expected to fail. If one starts passing, the
 * behaviour changed: move it to `captureParity.test.ts` and update the "Differences from Capture"
 * section of the program-rules README.
 */
import { rule } from '../../../program-rules/test/metadata'
import { dataElement } from './__fixtures__/builders'
import {
    captureFirstRun,
    captureSettled,
    oursView,
    type FormView,
    type ParityScenario,
} from './__fixtures__/capture'
import {
    assign,
    hide,
    largeEvent,
    largeScenario,
    largeVariation,
    rmnch,
    synthetic,
    visit,
    YES_NO,
} from './captureParityTestSupport'
import type { Values } from './overlay'

type ViewKey = keyof FormView

const VIEW_KEYS: ViewKey[] = [
    'visible',
    'values',
    'required',
    'messages',
    'hiddenFieldMessages',
    'options',
]

interface Difference {
    name: string
    /** The view properties in which the two sides differ. */
    differ: ViewKey[]
    /** This form's view and Capture's, in that order. */
    views: () => [FormView, FormView]
}

const settled =
    (scenario: ParityScenario, stored: Values) => (): [FormView, FormView] => [
        oursView(scenario, stored),
        captureSettled(scenario, stored),
    ]

/*
 * Each difference, with who is right. `it.fails` passes on any failure, so a guard test below
 * checks that each case differs in exactly the properties listed, and nowhere else.
 */
const differences: Difference[] = [
    {
        // Capture is right: a calculated value that is stored but not shown is a common DHIS2
        // pattern (Capture: "assignValueEffects has precedence over blank a hidden field"). Here
        // the hidden field wins (`overlay`), so the value is never saved.
        name: 'an ASSIGN into a hidden field is saved',
        differ: ['values'],
        views: settled(
            synthetic([
                rule('r', 'true', [hide('X'), assign('X', "'calculated'")]),
            ]),
            { A: 'a' }
        ),
    },
    {
        // Capture is consistent: it ends where its rules, run on the values it shows, change
        // nothing. Here pass 1 hides both and clears them; pass 2 reads both empty and hides
        // neither, so both are shown again with their stored answers, which, evaluated, hide each
        // other. Capture shows both empty: once it clears a value it never gets it back. Keeping
        // answers is deliberate here, but what is shown and saved is not what the effects were
        // computed from.
        name: 'mutual hide: two fields that each hide the other when answered',
        differ: ['values'],
        views: settled(
            synthetic([
                rule('r1', "d2:hasValue('a')", [hide('B')]),
                rule('r2', "d2:hasValue('b')", [hide('A')]),
            ]),
            { A: 'a', B: 'b' }
        ),
    },
    {
        // Capture is right. Each hide depends on the previous field being cleared, and two passes
        // see one clear: D stays visible with its value. Capture needs three runs (one per user
        // change), then hides and clears D.
        name: 'a hide chain three fields deep',
        differ: ['visible', 'values'],
        views: settled(
            synthetic([
                rule('r1', "d2:hasValue('a')", [hide('B')]),
                rule('r2', "!d2:hasValue('b')", [hide('C')]),
                rule('r3', "!d2:hasValue('c')", [hide('D')]),
            ]),
            { A: 'a', B: 'b', C: 'c', D: 'd' }
        ),
    },
    {
        // Capture is right to keep a compulsory field on screen. Here it is hidden and no longer
        // required, so the event can be completed without it and the server's mandatory check
        // may reject it. (Capture also blanks the field on every run while the hide holds; that
        // is not worth copying.)
        name: 'HIDEFIELD on a field the stage makes compulsory',
        differ: ['visible', 'required'],
        views: settled(
            synthetic(
                [rule('r', 'true', [hide('X')])],
                [dataElement('A'), dataElement('X', { compulsory: true })]
            ),
            { A: 'a', X: 'x' }
        ),
    },
    {
        // Capture is right, as above: SETMANDATORYFIELD keeps the field on screen in Capture.
        name: 'HIDEFIELD and SETMANDATORYFIELD on the same field',
        differ: ['visible', 'required'],
        views: settled(
            synthetic([
                rule('r', 'true', [
                    hide('X'),
                    { id: 'm', type: 'SETMANDATORYFIELD', dataElementId: 'X' },
                ]),
            ]),
            { A: 'a', X: 'x' }
        ),
    },
    {
        // A trade-off. Capture fails validation on a rule error attached to a field it hides, so
        // the user is stuck on an error they cannot see. Here hidden fields are skipped and the
        // save goes through, where the server's own rule run may reject it. Ours is the better
        // experience, Capture the closer match to the server.
        name: 'SHOWERROR on a hidden field',
        differ: ['hiddenFieldMessages'],
        views: settled(
            synthetic([
                rule('r', 'true', [
                    hide('X'),
                    {
                        id: 'e',
                        type: 'SHOWERROR',
                        dataElementId: 'X',
                        content: 'X is wrong',
                    },
                ]),
            ]),
            { A: 'a' }
        ),
    },
    {
        // The same trade-off: Capture's completion dialog lists errors and warnings on complete
        // for every field of the stage, hidden or not. Here they go with the hidden field.
        name: 'ERRORONCOMPLETE on a hidden field',
        differ: ['hiddenFieldMessages'],
        views: settled(
            synthetic([
                rule('r', 'true', [
                    hide('X'),
                    {
                        id: 'e',
                        type: 'ERRORONCOMPLETE',
                        dataElementId: 'X',
                        content: 'Fix X before completing',
                    },
                ]),
            ]),
            { A: 'a' }
        ),
    },
    {
        // Capture is right: it assigns nothing (clears the field) when the value is not one of
        // the field's option codes. Here the code is saved, and offered as a choice, though the
        // server rejects a value outside the option set.
        name: 'an ASSIGN of a code outside the option set',
        differ: ['values', 'options'],
        views: settled(
            synthetic(
                [rule('r', 'true', [assign('X', "'unsure'")])],
                [dataElement('X', { options: YES_NO })]
            ),
            {}
        ),
    },
    {
        // Capture is right: it drops effects on fields outside the stage. Here `overlay` puts the
        // value into the effective values, so the save sends a data value the stage lacks.
        name: 'an ASSIGN to a data element of another stage',
        differ: ['values'],
        views: settled(
            synthetic([rule('r', 'true', [assign('ELSEWHERE', "'x'")])]),
            { A: 'a' }
        ),
    },
    {
        // Capture normalises an assigned number by value type ("03" → "3", "5.0" → "5"); the
        // engine's text is saved as is here. Both are valid to the server, so this only matters
        // to exact comparisons of stored values. Capture's form is the cleaner one.
        name: 'an ASSIGN of a number written with a leading zero',
        differ: ['values'],
        views: settled(
            synthetic(
                [rule('r', 'true', [assign('X', "d2:right('2026-03', 2)")])],
                [dataElement('X', { valueType: 'INTEGER' })]
            ),
            {}
        ),
    },
    {
        // Ours is right, on purpose (`choicesOf`): the chosen option stays in the list, so the
        // field never looks blank while the event holds that value. Capture filters it out of
        // the list but keeps the value.
        name: 'HIDEOPTION of the chosen option',
        differ: ['options'],
        views: settled(
            synthetic(
                [
                    rule('r', 'true', [
                        {
                            id: 'ho',
                            type: 'HIDEOPTION',
                            dataElementId: 'X',
                            option: { id: 'o-yes', code: 'yes' },
                        },
                    ]),
                ],
                [dataElement('X', { options: YES_NO })]
            ),
            { X: 'yes' }
        ),
    },
    {
        // Ours is right. Capture runs the rules once per change and never on its own writes, so
        // right after a change it shows effects computed before its own clears: the aspirin and
        // "other chronic condition specified" fields stay on screen until the next change. The
        // settled comparison of the same visit above matches.
        name: 'RMNCH, the stored visit, against Capture right after the change',
        differ: ['visible', 'values'],
        views: () => [
            oursView(rmnch, visit()),
            captureFirstRun(rmnch, visit()),
        ],
    },
    {
        // The mutual-hide and three-deep mechanisms on generated data. With the current event the
        // newest, its own values feed the rules: Capture clears fields during one run that the
        // next run shows again (empty), and some hide chains go deeper than two passes.
        name: 'the large generated program, a variation of the current event as the newest',
        differ: ['visible', 'values', 'messages', 'hiddenFieldMessages'],
        views: settled(
            largeScenario('2026-12-01T12:00:00.000'),
            largeVariation(2)
        ),
    },
    {
        // The SHOWERROR trade-off on generated data.
        name: 'the large generated program, its stored event',
        differ: ['hiddenFieldMessages'],
        views: settled(largeScenario(), largeEvent.dataValues),
    },
]

const differingKeys = ([ours, capture]: [FormView, FormView]): ViewKey[] =>
    VIEW_KEYS.filter(
        (key) => JSON.stringify(ours[key]) !== JSON.stringify(capture[key])
    )

describe('differences from Capture', () => {
    for (const difference of differences) {
        it.fails(difference.name, () => {
            const [ours, capture] = difference.views()
            expect(ours).toEqual(capture)
        })
    }

    it('each difference is where its case says, and nowhere else', () => {
        for (const difference of differences) {
            expect([
                difference.name,
                differingKeys(difference.views()),
            ]).toEqual([difference.name, difference.differ])
        }
    })
})
