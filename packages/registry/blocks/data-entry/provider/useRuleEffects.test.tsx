/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import type { CustomDataProvider } from '@dhis2/app-runtime'
import type { ComponentProps } from 'react'
import { page, userEvent } from 'vitest/browser'
import { z } from 'zod'
import {
    RMNCH,
    rmnchEnrollmentResponse,
    rmnchResponses,
} from '@/components/program-rules/__tests__/rmnch'
import { DataGrid } from '../grid/DataGrid'
import { control } from '../grid/__tests__/gridRig'
import { rowHeaderDomId } from '../grid/headers'
import { cellKey } from '../model/types'
import meAdmin from '../sources/__tests__/fixtures/me-admin.json'
import rmnchProgram from '../sources/__tests__/fixtures/rmnch-program.json'
import { eventSource } from '../sources/eventSource'
import type { DataEngine, DataEntrySource } from '../sources/types'
import { DataEntrySummary } from '../summary/DataEntrySummary'
import {
    change,
    cleanUp,
    freshServer,
    holdIdle,
    later,
    memorySource,
    mount,
    withOutbox,
} from './__tests__/rig'
import { rowIdOf } from './formRows'

afterEach(cleanUp)
beforeEach(() => {
    performance.clearMeasures('data-entry:rules')
    performance.clearMeasures('data-entry:rules-edit')
    performance.clearMeasures('data-entry:rules-visible')
})

const FIRST_VISIT = RMNCH.eventId
const LATER_VISIT = 'H693QbyyYhi'
const ANTENATAL = new Set<string>([RMNCH.stageId, 'edqlbukwRfQ'])
const GESTATIONAL_AGE = RMNCH.gestationalAge
const ASSIGNED = 'Assigned by rule: Calculate gestational age from LMP'
const CLEARED =
    'Cleared by rule: Hide all fields for chronic conitions unless the w'
const LMP = cellKey(FIRST_VISIT, RMNCH.lmp)
const HEMOGLOBIN = 'vANAXwtLwcT'
const FOLLOW_UPS = RMNCH.chronicFollowUps.map((id) => cellKey(FIRST_VISIT, id))

interface FixtureEvent {
    event: string
    enrollment: string
    programStage: string
    orgUnit: string
    occurredAt: string
    status: string
    dataValues: Array<{ dataElement: string; value: string }>
}

/** Person `k`, a copy of the RMNCH person whose ids end in `k`; person 0 is the fixture's own. */
const personId = (k: number) => `${RMNCH.enrollmentId.slice(0, -1)}${k}`
const eventId = (id: string, k: number) =>
    k === 0 ? id : `${id.slice(0, -1)}${k}`

/** Person `k`'s events, as the server has them. */
const eventsOf = (k: number): FixtureEvent[] =>
    rmnchEnrollmentResponse.events.map((event) => ({
        event: eventId(event.event, k),
        enrollment: personId(k),
        programStage: event.programStage,
        orgUnit: event.orgUnit,
        occurredAt: event.occurredAt,
        status: event.status,
        dataValues: event.dataValues.map(({ dataElement, value }) => ({
            dataElement,
            value,
        })),
    }))

const antenatalOf = (k: number) =>
    eventsOf(k).filter(({ programStage }) => ANTENATAL.has(programStage))

/** The event with one value set, or removed when `value` is undefined. */
const withValue = (
    event: FixtureEvent,
    dataElement: string,
    value?: string
): FixtureEvent => ({
    ...event,
    dataValues: [
        ...event.dataValues.filter((each) => each.dataElement !== dataElement),
        ...(value === undefined ? [] : [{ dataElement, value }]),
    ],
})

/** What the server sends: plain JSON, no `undefined` members. */
const json = <T,>(body: T) => z.json().parse(JSON.parse(JSON.stringify(body)))

const answering = <T,>(answer: T) =>
    // SAFETY: loading only calls `query`, which answers every request with the fixtures.
    ({
        query: async (_query: Parameters<DataEngine['query']>[0]) => answer,
    }) as DataEngine

/** The grid `eventSource` loads for these RMNCH events. */
const rmnchForm = (events: ReadonlyArray<FixtureEvent>) =>
    eventSource({
        programId: RMNCH.programId,
        orgUnitId: 'm7fBMpmVpSM',
        order: 'occurredAt:asc',
        today: '2026-10-26',
    }).load(
        answering({ program: rmnchProgram, events: { events }, me: meAdmin })
    )

/** The RMNCH rules, and every person asked for. */
const RULES = {
    programRules: async () => json(rmnchResponses.rules),
    programRuleVariables: async () => json(rmnchResponses.variables),
    constants: async () => json(rmnchResponses.constants),
    programs: async () => json(rmnchResponses.program),
    'tracker/enrollments': async (_type, query) =>
        json({
            pager: { page: 1, pageSize: 100 },
            enrollments: String(query.params?.enrollments)
                .split(',')
                .map((id) => ({
                    ...rmnchEnrollmentResponse,
                    enrollment: id,
                    events: eventsOf(Number(id.at(-1))),
                })),
        }),
} satisfies ComponentProps<typeof CustomDataProvider>['data']

const rulesRan = () =>
    expect
        .poll(
            () => performance.getEntriesByName('data-entry:rules', 'measure'),
            { timeout: 10_000 }
        )
        .toHaveLength(1)

const mountRmnch = async (
    events: ReadonlyArray<FixtureEvent>,
    server = freshServer()
) => {
    const form = await rmnchForm(events)
    const memory = memorySource(form)
    const mounted = await mount(memory.source, { data: RULES, server })
    await rulesRan()
    return { form, memory, ...mounted }
}

/** The cells of every change sent so far. */
const sentKeys = (memory: ReturnType<typeof memorySource>) =>
    memory.sent.flat().map(({ key }) => key)

test('evaluates the visible rows first and the rest when idle', async () => {
    const idle = holdIdle()
    const events = Array.from({ length: 10 }, (_, k) =>
        antenatalOf(k).map((event) =>
            event.event === eventId(FIRST_VISIT, k)
                ? withValue(event, RMNCH.lmp, '2026-01-01')
                : event
        )
    ).flat()
    const { form, context, memory } = await mountRmnch(events)
    const rows = form.tables[0].rows
    expect(rows).toHaveLength(60)
    const assigned = (id: string) =>
        context().effects.getState().cells[cellKey(id, GESTATIONAL_AGE)]
            ?.readOnly === ASSIGNED

    // The first row is in view, so it is in the first slice.
    expect(assigned(rows[0].id)).toBe(true)
    idle.run()
    expect(rows.filter(({ id }) => assigned(id))).toHaveLength(60)
    // Shown, not saved: no person changed these rows.
    await later(100)
    expect(memory.sent).toEqual([])
})

test('opening the grid changes nothing; a person’s first change in a row saves that row’s rule changes with it', async () => {
    const { context, view, memory } = await mountRmnch(eventsOf(0))
    const [followUp] = FOLLOW_UPS
    await later(200)
    expect(memory.sent).toEqual([])
    expect(view().summary.unsent).toBe(0)
    // No chronic conditions: the follow-ups are hidden, and keep their values.
    expect(context().store.getState().cells[followUp]?.value).toBe('true')
    expect(context().effects.getState().cells[followUp]?.hiddenBy).toBe(
        'Hidden by rule: Hide all fields for chronic conitions unless the w'
    )

    control(LMP).focus()
    await userEvent.keyboard('2026-01-01{Enter}')
    await expect.poll(() => memory.sent).toHaveLength(1)
    // One save for the event: the date, its gestational age and the hidden follow-ups cleared.
    expect(sentKeys(memory)).toEqual(
        expect.arrayContaining([
            LMP,
            cellKey(FIRST_VISIT, GESTATIONAL_AGE),
            ...FOLLOW_UPS,
        ])
    )
    expect(new Set(sentKeys(memory).map(rowIdOf))).toEqual(
        new Set([FIRST_VISIT])
    )
    // The later visit, untouched, keeps the value DHIS2 holds (none), locked by its rule, and saves nothing.
    expect(
        context().effects.getState().cells[
            cellKey(LATER_VISIT, GESTATIONAL_AGE)
        ]?.readOnly
    ).toBe(ASSIGNED)
    expect(
        context().store.getState().cells[cellKey(LATER_VISIT, GESTATIONAL_AGE)]
    ).toBeUndefined()
})

test('a row with unsent changes saves its rule changes when the grid opens', async () => {
    const server = freshServer()
    await withOutbox(server, (outbox) => outbox.put(change(LMP, '2026-01-01')))
    const { memory } = await mountRmnch(eventsOf(0), server)
    await expect
        .poll(() => sentKeys(memory))
        .toEqual(expect.arrayContaining([LMP, ...FOLLOW_UPS]))
    expect(new Set(sentKeys(memory).map(rowIdOf))).toEqual(
        new Set([FIRST_VISIT])
    )
})

test('completing a row saves its rule changes first, and keeps its rule effects', async () => {
    const memory = memorySource(await rmnchForm(eventsOf(0)))
    let sentFirst: string[] = []
    const source: DataEntrySource = {
        ...memory.source,
        setStatus: (...args) => {
            sentFirst = sentKeys(memory)
            return memory.source.setStatus(...args)
        },
    }
    const { context, view } = await mount(source, { data: RULES })
    await rulesRan()
    const hidden = context().effects.getState().cells[FOLLOW_UPS[0]]?.hiddenBy
    expect(hidden).toBeDefined()
    expect(memory.sent).toEqual([])

    expect(await view().complete(FIRST_VISIT)).toMatchObject([
        { result: 'saved' },
    ])
    expect(sentFirst).toEqual(expect.arrayContaining(FOLLOW_UPS))
    expect(new Set(sentFirst.map(rowIdOf))).toEqual(new Set([FIRST_VISIT]))
    expect(memory.statuses).toEqual([[FIRST_VISIT, 'COMPLETED']])
    // The saved status rewrote the row's effects from the form; the rules' come back.
    await expect
        .poll(() => context().effects.getState().cells[FOLLOW_UPS[0]]?.hiddenBy)
        .toBe(hidden)
})

test('shows the rules’ notes under the row’s label', async () => {
    // Ten weeks and two days ago.
    const lmp = new Date(Date.now() - 72 * 86_400_000).toLocaleDateString('sv')
    const { context, form } = await mountRmnch(
        eventsOf(0).map((event) =>
            event.event === FIRST_VISIT
                ? withValue(event, RMNCH.lmp, lmp)
                : event
        )
    )
    // Around midnight the rules' today may be a day off the test's.
    const ageNow = /^Gest\. age 10\+[1-3]$/
    expect(context().effects.getState().rowNotes.get(FIRST_VISIT)).toEqual([
        expect.stringMatching(ageNow),
    ])
    const header = document
        .getElementById(rowHeaderDomId(form.tables[0].id, FIRST_VISIT))
        ?.closest('th')
    const note = [...(header?.querySelectorAll('[dir="auto"]') ?? [])].at(-1)
    await expect
        .element(page.elementLocator(note ?? document.body))
        .toHaveTextContent(ageNow)
})

test('an edit to a cross-event field re-runs the person’s rows', async () => {
    const { context } = await mountRmnch([...antenatalOf(0), ...antenatalOf(1)])
    const ageOf = (eventId: string) => ({
        value: context().store.getState().cells[
            cellKey(eventId, GESTATIONAL_AGE)
        ]?.value,
        readOnly:
            context().effects.getState().cells[
                cellKey(eventId, GESTATIONAL_AGE)
            ]?.readOnly,
    })

    control(LMP).focus()
    await userEvent.keyboard('2026-01-01{Enter}')
    // The edited visit saves its age: 1 January to 12 March is 10 weeks.
    await expect
        .poll(() => ageOf(FIRST_VISIT))
        .toEqual({ value: '10', readOnly: ASSIGNED })
    // The later visit reads the date as the person's newest one; it is shown, not saved.
    expect(ageOf(LATER_VISIT)).toEqual({ value: undefined, readOnly: ASSIGNED })
    expect(ageOf(eventId(LATER_VISIT, 1))).toEqual({
        value: undefined,
        readOnly: undefined,
    })
    expect(
        performance.getEntriesByName('data-entry:rules-edit', 'measure')
    ).toHaveLength(1)
})

test('announces a value cleared by a rule', async () => {
    const [empty, ...cleared] = RMNCH.chronicFollowUps
    // Chronic conditions: yes, so the follow-ups show; one of them is empty.
    const { view, context, memory } = await mountRmnch(
        eventsOf(0).map((event) =>
            event.event === FIRST_VISIT
                ? withValue(withValue(event, RMNCH.chronic, 'true'), empty)
                : event
        )
    )
    const clearedItems = () =>
        view()
            .summary.items.filter(({ text }) => text === CLEARED)
            .map(({ key }) => key)
            .sort()
    expect(clearedItems()).toEqual([])
    // Nothing is saved, so no "All changes saved" follows what the rule said.
    memory.hold()

    control(cellKey(FIRST_VISIT, RMNCH.chronic)).focus()
    await userEvent.keyboard('n')
    const keys = cleared.map((id) => cellKey(FIRST_VISIT, id))
    await expect.poll(clearedItems).toEqual([...keys].sort())
    expect(
        context().effects.getState().cells[cellKey(FIRST_VISIT, empty)]
            ?.hiddenBy
    ).toBeDefined()
    for (const key of keys) {
        expect(context().store.getState().cells[key]).toMatchObject({
            value: undefined,
            source: 'rule',
        })
    }
    await expect.element(page.getByRole('status')).toHaveTextContent(CLEARED)
})

test('writes performance marks', async () => {
    const { context } = await mountRmnch(eventsOf(0))
    context().store.getState().commit(LMP, '2026-01-01')
    await expect
        .poll(() =>
            performance.getEntriesByName('data-entry:rules-edit', 'measure')
        )
        .toHaveLength(1)
    expect(
        performance.getEntriesByName('data-entry:rules', 'measure')
    ).toHaveLength(1)
    // Every row is in view, so the visible rows were done in the first slice.
    expect(
        performance.getEntriesByName('data-entry:rules-visible', 'measure')
    ).toHaveLength(1)
})

test('a rule waits for the person to leave the cell they are typing in', async () => {
    const { context } = await mountRmnch(antenatalOf(0))
    const age = cellKey(LATER_VISIT, GESTATIONAL_AGE)
    // The person has changed the later visit, so its rule changes are saved.
    context().store.getState().commit(cellKey(LATER_VISIT, HEMOGLOBIN), '11')

    control(age).focus()
    await userEvent.keyboard('3')
    // Another change makes the rules assign the cell being typed in.
    context().store.getState().commit(LMP, '2026-01-01')
    await expect
        .poll(() => context().effects.getState().cells[age]?.readOnly)
        .toBe(ASSIGNED)
    await later(100)
    expect(context().store.getState().cells[age]).toBeUndefined()

    await userEvent.keyboard('{Tab}')
    await expect
        .poll(() => context().store.getState().cells[age])
        .toMatchObject({ value: '21', source: 'rule' })
})

test('a row cannot complete while the program rules load', async () => {
    const memory = memorySource(await rmnchForm(eventsOf(0)))
    const { view } = await mount(memory.source, {
        data: { ...RULES, programRules: () => new Promise<never>(() => {}) },
    })
    expect(await view().complete(FIRST_VISIT)).toMatchObject([
        { result: 'failed', reason: 'Program rules are still loading' },
    ])
    expect(memory.statuses).toEqual([])
})

test('rules that cannot be loaded block completion, and the summary says so', async () => {
    const memory = memorySource(await rmnchForm(eventsOf(0)))
    const failure = 'Program rules could not be loaded'
    const { view } = await mount(memory.source, {
        data: {
            ...RULES,
            programRules: async () => {
                throw new FetchError({ type: 'access', message: 'No access' })
            },
        },
        children: (
            <>
                <DataGrid />
                <DataEntrySummary />
            </>
        ),
    })
    await expect
        .poll(() => view().summary.items)
        .toContainEqual({ key: '', kind: 'error', text: failure })
    expect(view().summary.canComplete).toBe(false)
    expect(await view().complete(FIRST_VISIT)).toMatchObject([
        { result: 'failed', reason: failure },
    ])
    expect(memory.statuses).toEqual([])
    // A message of the whole form, with no row before it.
    await expect
        .element(page.getByRole('listitem').filter({ hasText: failure }))
        .toHaveTextContent(new RegExp(`^${failure}$`))
})

test('text typed into a cell a rule hides is saved, then cleared by the rule', async () => {
    // "Other chronic condition": yes, so "specified" shows, empty.
    const OTHER = 'xPTngRLQTnu'
    const SPECIFIED = 'Mh7nK8UKoZP'
    const { context, view } = await mountRmnch(
        eventsOf(0).map((event) =>
            event.event === FIRST_VISIT
                ? withValue(
                      withValue(
                          withValue(event, RMNCH.chronic, 'true'),
                          OTHER,
                          'true'
                      ),
                      SPECIFIED
                  )
                : event
        )
    )
    const specified = cellKey(FIRST_VISIT, SPECIFIED)
    const hiddenBy = () =>
        context().effects.getState().cells[specified]?.hiddenBy
    expect(hiddenBy()).toBeUndefined()

    control(specified).focus()
    await userEvent.keyboard('Asthma')
    // Meanwhile the answer that shows the cell becomes no, and a rule hides it.
    context().store.getState().commit(cellKey(FIRST_VISIT, OTHER), 'false')
    await expect.poll(hiddenBy).toBeDefined()
    await userEvent.keyboard('{Tab}')
    await expect
        .poll(() =>
            view()
                .summary.items.filter(({ key }) => key === specified)
                .map(({ text }) => text)
        )
        .toContain(
            'Cleared by rule: Hide field for -other chronic conditions specified'
        )
    expect(context().store.getState().cells[specified]).toMatchObject({
        value: undefined,
        source: 'rule',
    })
})
