import { describe, expect, it } from 'vitest'
import { sourceFile, type CanvasSource } from '../canvasSource'
import tableCode from '../working-list/table/TableCanvas.tsx?raw'
import calendarCode from '../working-list/calendar/CalendarCanvas.tsx?raw'
import observationsCode from '../observation-cards/ObservationsCanvas.tsx?raw'
import timelineCode from '../timeline/TimelineCanvas.tsx?raw'

const source: CanvasSource = {
    name: 'TableCanvas.tsx',
    code: tableCode,
    props: { programId: 'labProgram1', view: { pageSize: 10 } },
}

describe('canvas source files', () => {
    it('returns the actual composition source unchanged, not generated JSX', () => {
        expect(sourceFile(source, 'composition')).toEqual({
            language: 'tsx',
            code: tableCode,
        })
    })

    it('serializes the current inputs and reflects changes', () => {
        expect(JSON.parse(sourceFile(source, 'props').code)).toEqual(
            source.props
        )
        const next = { ...source, props: { view: { pageSize: 25 } } }
        expect(sourceFile(next, 'props')).toEqual({
            language: 'json',
            code: JSON.stringify(next.props, null, 2),
        })
    })

    it('omits callbacks and undefined props from the JSON snapshot', () => {
        const next = {
            ...source,
            props: {
                programId: 'liveProgram',
                defaultViewId: undefined,
                note: () => {},
            },
        }
        expect(JSON.parse(sourceFile(next, 'props').code)).toEqual({
            programId: 'liveProgram',
        })
    })

    it.each([
        ['TableCanvas', tableCode, 'WorkingListTable'],
        ['CalendarCanvas', calendarCode, 'WorkingListCalendarGrid'],
        ['ObservationsCanvas', observationsCode, 'ObservationCard'],
        ['TimelineCanvas', timelineCode, 'TimelineFeed'],
    ])('ships the %s source module', (name, code, part) => {
        expect(code).toContain(`export const ${name}`)
        expect(code).toContain(`<${part}`)
        expect(code).not.toContain('LabLayout')
    })
})
