import { describe, expect, it } from 'vitest'
import { inspectCanvas } from '../../../canvasSourcePlugin'
import { propValue, type CanvasSource } from '../canvasSource'
import table from '../working-list/table/TableCanvas.tsx?canvas'
import calendar from '../working-list/calendar/CalendarCanvas.tsx?canvas'
import observations from '../observation-cards/ObservationsCanvas.tsx?canvas'
import timeline from '../timeline/TimelineCanvas.tsx?canvas'
import finder from '../tracked-entity-finder/LabFinder.tsx?canvas'
import tableCode from '../working-list/table/TableCanvas.tsx?raw'
import calendarCode from '../working-list/calendar/CalendarCanvas.tsx?raw'
import observationsCode from '../observation-cards/ObservationsCanvas.tsx?raw'
import timelineCode from '../timeline/TimelineCanvas.tsx?raw'
import finderCode from '../tracked-entity-finder/LabFinder.tsx?raw'

const source: CanvasSource = {
    ...table,
    props: { programId: 'labProgram1', view: { pageSize: 10 } },
}
const pageSize = table.references.find(
    ({ path }) => path.join('.') === 'view.pageSize'
)!

describe('canvas prop inspection', () => {
    it('resolves nested current inputs and reflects changes', () => {
        expect(propValue(source, pageSize)).toBe('10')
        expect(
            propValue(
                { ...source, props: { view: { pageSize: 25 } } },
                pageSize
            )
        ).toBe('25')
    })

    it.each([
        [false, 'false'],
        [0, '0'],
        ['', '""'],
        [null, 'null'],
        [undefined, 'undefined'],
        [() => {}, '[Function]'],
        [['one', 'two'], '[\n  "one",\n  "two"\n]'],
    ])('describes a prop value (%s)', (value, text) => {
        expect(
            propValue(
                { ...source, props: { value } },
                { start: 0, end: 1, path: ['value'] }
            )
        ).toBe(text)
    })

    it('ignores missing and inherited props and never invokes getters', () => {
        const next = {
            ...source,
            props: {
                get value() {
                    throw new Error('must not be read')
                },
            },
        }
        for (const path of [['missing'], ['toString'], ['value']]) {
            expect(propValue(next, { start: 0, end: 1, path })).toBeUndefined()
        }
    })

    it('annotates destructured props and reads, not interface fields, JSX attribute names or shadowed locals', () => {
        const code = `interface Props { programId: string; view: View; count: number }
        export const Demo = ({ programId, view, count: total }: Props) => {
            const local = 'not a prop'
            return <Block programId={programId} pageSize={view.pageSize} count={total}
                value={local} literal="programId" onClick={(programId) => programId} />
        }`
        const result = inspectCanvas(code)
        expect(
            result.references.map((reference) => ({
                text: code.slice(reference.start, reference.end),
                path: reference.path,
            }))
        ).toEqual([
            { text: 'programId', path: ['programId'] },
            { text: 'view', path: ['view'] },
            { text: 'total', path: ['count'] },
            { text: 'programId', path: ['programId'] },
            { text: 'view.pageSize', path: ['view', 'pageSize'] },
            { text: 'total', path: ['count'] },
        ])
    })

    it('finds shorthand hook inputs and bracketed property reads', () => {
        const result =
            inspectCanvas(`export const Demo = ({ person, view }) => {
            const history = useHistory({ person })
            return <Block pageSize={view['pageSize']} entries={history.entries} />
        }`)
        expect(result.references.map(({ path }) => path)).toEqual([
            ['person'],
            ['view'],
            ['person'],
            ['view', 'pageSize'],
        ])
    })

    it.each([
        ['table', table, tableCode, 'programId'],
        ['calendar', calendar, calendarCode, 'programId'],
        ['observations', observations, observationsCode, 'trackedEntity'],
        ['timeline', timeline, timelineCode, 'trackedEntity'],
        ['finder', finder, finderCode, 'program'],
    ] as const)(
        'ships %s source with inspectable props',
        (_name, module, raw, input) => {
            expect(module.code).toBe(raw)
            expect(module.code).not.toContain('LabLayout')
            expect(module.references.map(({ path }) => path)).toContainEqual([
                input,
            ])
            for (const reference of module.references) {
                expect(
                    module.code.slice(reference.start, reference.end)
                ).not.toBe('')
            }
        }
    )

    it.each([
        ['untyped', ''],
        ['interface', 'interface Inputs { id: string }'],
        ['type alias', 'type Inputs = { id: string }'],
    ])(
        'inspects %s destructured inputs without depending on type spelling',
        (_name, declaration) => {
            const annotation = declaration ? ': Inputs' : ''
            const code = `${declaration}
        export const Example = ({ id: record }${annotation}) => <Block id={record} />`
            const result = inspectCanvas(code)
            expect(result.code).toBe(code)
            expect(
                result.references.map(({ start, end, path }) => ({
                    text: code.slice(start, end),
                    path,
                }))
            ).toEqual([
                { text: 'record', path: ['id'] },
                { text: 'record', path: ['id'] },
            ])
        }
    )
})
