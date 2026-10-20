import { CustomDataProvider, useDataEngine } from '@dhis2/app-runtime'
import {
    EventForm,
    EventFormSectionNav,
    useEventFormRules,
} from '@dhis2-blocks/event-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps } from 'react'
import { vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import eventFixture from '../../../../../../packages/blocks/event-form/src/api/__fixtures__/event.json'
import stageFixture from '../../../../../../packages/blocks/event-form/src/api/__fixtures__/rmnch-stage.json'
import {
    rmnchEnrollmentResponse,
    rmnchResponses,
} from '../../../../../../packages/blocks/program-rules/test/rmnch'
import { createAppWorkingListClient } from '../../AppShell/createAppWorkingListClient'
import { RulesLensProvider, RulesLensSections } from '.'

const RMNCH = {
    programId: 'WSGAb5XwJ3Y',
    stageId: 'WZbXY0S00lP',
    enrollmentId: 'PE6abx7Zhn0',
    eventId: 'Evahwp3zrQ4',
    orgUnitId: 'm7fBMpmVpSM',
    chronic: 'de0FEHSIoxh',
    diabetes: 'Q1x1HIhuwFN',
} as const

const labelOf = (id: string) =>
    stageFixture.programStages
        .flatMap((stage) => stage.programStageDataElements)
        .find((entry) => entry.dataElement.id === id)?.dataElement
        .displayFormName ?? id

type CustomData = ComponentProps<typeof CustomDataProvider>['data']
type ResourceFactory = Extract<CustomData[string], (...args: never[]) => void>
type ResourceQuery = Parameters<ResourceFactory>[1]

/** Plain JSON, as it arrives over the wire. */
const wire = <T,>(value: T) => z.json().parse(JSON.parse(JSON.stringify(value)))

/** The program as the rules lens labels query asks for it. */
const programLabels = {
    programStages: stageFixture.programStages.map((stage) => ({
        id: stage.id,
        displayName: stage.displayName,
        programStageDataElements: stage.programStageDataElements.map(
            ({ dataElement }) => ({
                dataElement: {
                    id: dataElement.id,
                    displayName: dataElement.displayFormName,
                    displayFormName: dataElement.displayFormName,
                },
            })
        ),
        programStageSections: stage.programStageSections,
    })),
    programTrackedEntityAttributes: [],
}

const data = {
    programs: async (_type: string, query: ResourceQuery) => {
        const fields = String(query.params?.fields)
        if (fields.includes('programTrackedEntityAttributes')) {
            return wire(programLabels)
        }
        return wire(
            fields.includes('programStageDataElements')
                ? stageFixture
                : rmnchResponses.program
        )
    },
    'tracker/events': async () => wire(eventFixture),
    'system/info': async () =>
        wire({ calendar: 'iso8601', dateFormat: 'yyyy-mm-dd' }),
    me: async () =>
        wire({
            ...rmnchResponses.me,
            organisationUnits: [{ id: 'ImspTQPwCqd' }],
        }),
    programRules: async () => wire(rmnchResponses.rules),
    programRuleVariables: async () => wire(rmnchResponses.variables),
    constants: async () => wire(rmnchResponses.constants),
    organisationUnitGroups: async () => wire({ organisationUnitGroups: [] }),
    'tracker/enrollments': async () => wire(rmnchEnrollmentResponse),
    organisationUnits: async (_type: string, query: ResourceQuery) =>
        wire({
            id: query.id,
            displayName: 'Kolisokor MCHP',
            path: `/ImspTQPwCqd/${query.id}`,
            ancestors: [{ displayName: 'Sierra Leone' }],
        }),
}

/** The form's rule status, read by the lens part, so a test can wait for the rules. */
interface Probe {
    status?: string
}

const probe: Probe = {}

const Lens = () => {
    const client = createAppWorkingListClient(useDataEngine())
    probe.status = useEventFormRules().status
    return (
        <RulesLensProvider
            client={client}
            programId={RMNCH.programId}
            programStageId={RMNCH.stageId}
        >
            <EventFormSectionNav />
            <RulesLensSections />
        </RulesLensProvider>
    )
}

const renderLens = async () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    await render(
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                <EventForm
                    programId={RMNCH.programId}
                    programStageId={RMNCH.stageId}
                    enrollmentId={RMNCH.enrollmentId}
                    orgUnitId={RMNCH.orgUnitId}
                    eventId={RMNCH.eventId}
                    onSaved={vi.fn()}
                    onCancel={vi.fn()}
                >
                    <Lens />
                </EventForm>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    await expect.poll(() => probe.status, { timeout: 15_000 }).toBe('ready')
}

describe('Rules lens on the Event Form', () => {
    it('shows hidden fields in place and explains the rule behind them', async () => {
        await renderLens()
        // Chronic conditions is No in the fixture, so a rule hides its follow-ups.
        const placeholder = page
            .getByTestId('rules-lens-hidden-field')
            .filter({ hasText: labelOf(RMNCH.diabetes) })
        await expect.element(placeholder).toBeVisible()

        await placeholder.getByRole('button', { name: 'Hidden' }).click()

        await expect
            .element(placeholder.getByTestId('rules-lens-explanation'))
            .toHaveTextContent(/Hidden by/)
    })

    it('tags the fields a rule reads and keeps the section navigation', async () => {
        await renderLens()
        const chronic = page
            .getByTestId('rules-lens-field')
            .filter({ hasText: labelOf(RMNCH.chronic) })
        await expect
            .element(
                chronic.getByRole('button', { name: /^Controls \d+ fields$/ })
            )
            .toBeVisible()
        await expect
            .element(page.getByRole('navigation', { name: 'Sections' }))
            .toBeVisible()
    })
})
