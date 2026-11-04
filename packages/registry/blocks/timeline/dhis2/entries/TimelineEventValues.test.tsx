import type React from 'react'
import {
    buttonIn,
    eventEntryOf,
    recordedEvent,
    recordedProgram,
    renderEntries,
    stageOf,
    type ProgramMetadata,
} from '../__tests__/fixtures/renderEntries'
import {
    TimelineEventEntry,
    TimelineEventStage,
    TimelineEventValues,
} from './TimelineEventEntry'

const SECOND_VISIT = 'edqlbukwRfQ'
const PREVIOUS_DELIVERIES = 'PUZaKR0Jh2k'

const renderEvent = (
    event: ReturnType<typeof recordedEvent>,
    parts: React.ReactNode,
    options: {
        /** Edits the program metadata the entry is resolved with. */
        metadata?: (metadata: ProgramMetadata) => void
        /** The program's metadata couldn't be read. */
        withoutMetadata?: boolean
    } = {}
) => {
    const entry = eventEntryOf(event, {
        program: options.withoutMetadata
            ? null
            : recordedProgram(options.metadata),
    })
    return renderEntries(
        <TimelineEventEntry entry={entry}>{parts}</TimelineEventEntry>
    )
}

const withValues = (
    event: ReturnType<typeof recordedEvent>,
    dataValues: Array<[string, string]>
) => ({
    ...event,
    dataValues: dataValues.map(([dataElement, value]) => ({
        dataElement,
        value,
    })),
})

describe('TimelineEventValues', () => {
    it("shows the stage's displayInReports values, rendered by formatDhis2Value", async () => {
        const event = withValues(recordedEvent('TlE2eEvt001'), [
            ['mrVkW9h2Rdp', 'Live born'],
            ['W4zW3aPyS0G', 'Vaginal'],
            ['wqpUVEeJR3D', '39'],
        ])
        const { container } = await renderEvent(
            event,
            <TimelineEventValues />,
            {
                metadata: (metadata) => {
                    const element = stageOf(metadata, PREVIOUS_DELIVERIES)
                        .programStageDataElements[0].dataElement
                    const option = element.optionSet?.options[0]
                    if (option) option.displayName = 'Live birth'
                },
            }
        )

        await expect.poll(() => container.querySelector('dl')).not.toBeNull()
        const items = [...container.querySelectorAll('dt, dd')].map(
            (node) => node.textContent
        )
        expect(items).toContain('Outcome')
        expect(items).toContain('Live birth')
        // Data elements the stage does not flag are not shown.
        expect(container.textContent).not.toContain('39')
    })

    it('shows dataElementIds instead when given', async () => {
        const event = withValues(recordedEvent('TlE2eEvt004'), [
            ['roKuXYfw1BW', '26'],
            ['cKBSkBB3Mt4', 'true'],
        ])
        const { container } = await renderEvent(
            event,
            <TimelineEventValues dataElementIds={['cKBSkBB3Mt4']} />
        )

        await expect.poll(() => container.querySelector('dl')).not.toBeNull()
        const text = container.textContent ?? ''
        expect(text).toContain('Antihypertensive drug given according to')
        expect(text).toContain('Yes')
        expect(text).not.toContain('Gestational age')
    })

    it('shows 5 values and the rest behind "Show N more"', async () => {
        const ids = Array.from({ length: 7 }, (_, index) => `extra${index}`)
        const event = withValues(
            recordedEvent('TlE2eEvt004'),
            ids.map((id): [string, string] => [id, `value ${id}`])
        )
        const { container } = await renderEvent(
            event,
            <TimelineEventValues />,
            {
                metadata: (metadata) => {
                    const stage = stageOf(metadata, SECOND_VISIT)
                    stage.programStageDataElements = ids.map((id) => ({
                        displayInReports: true,
                        dataElement: {
                            id,
                            displayName: `Element ${id}`,
                            valueType: 'TEXT',
                        },
                    }))
                },
            }
        )

        await expect
            .poll(() => container.querySelectorAll('dd'))
            .toHaveLength(5)
        const more = buttonIn(container)
        expect(more.textContent).toBe('Show 2 more')
        expect(more.getAttribute('aria-expanded')).toBe('false')

        more.click()

        await expect
            .poll(() => container.querySelectorAll('dd'))
            .toHaveLength(7)
        expect(more.textContent).toBe('Show fewer')
        expect(more.getAttribute('aria-expanded')).toBe('true')
    })

    it('shows no values when the stage flags none', async () => {
        const event = withValues(recordedEvent('TlE2eEvt004'), [
            ['roKuXYfw1BW', '26'],
        ])
        const { container } = await renderEvent(
            event,
            <>
                <TimelineEventStage />
                <TimelineEventValues />
            </>,
            {
                metadata: (metadata) => {
                    for (const element of stageOf(metadata, SECOND_VISIT)
                        .programStageDataElements) {
                        element.displayInReports = false
                    }
                },
            }
        )

        await expect
            .poll(() => container.textContent)
            .toContain('Second antenatal care visit')
        expect(container.querySelector('dl')).toBeNull()
        expect(container.textContent).not.toContain('26')
    })

    it("shows every value under its data element id when the program's metadata couldn't be read", async () => {
        const event = withValues(recordedEvent('TlE2eEvt004'), [
            ['roKuXYfw1BW', '26'],
            ['cKBSkBB3Mt4', 'true'],
        ])
        const { container } = await renderEvent(
            event,
            <TimelineEventValues />,
            { withoutMetadata: true }
        )

        await expect.poll(() => container.querySelector('dl')).not.toBeNull()
        const items = [...container.querySelectorAll('dt, dd')].map(
            (node) => node.textContent
        )
        expect(items).toEqual(['roKuXYfw1BW', '26', 'cKBSkBB3Mt4', 'true'])
    })

    it("shows a requested value under its id when the stage doesn't have its data element", async () => {
        const event = withValues(recordedEvent('TlE2eEvt004'), [
            ['notInStage1', '12'],
        ])
        const { container } = await renderEvent(
            event,
            <TimelineEventValues dataElementIds={['notInStage1']} />
        )

        await expect.poll(() => container.querySelector('dl')).not.toBeNull()
        const items = [...container.querySelectorAll('dt, dd')].map(
            (node) => node.textContent
        )
        expect(items).toEqual(['notInStage1', '12'])
    })
})
