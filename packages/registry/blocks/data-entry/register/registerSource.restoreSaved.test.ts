import { expect, test, vi } from 'vitest'
import type { EventRecord } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import { trackerEngine } from '../sources/__tests__/trackerRig'
import type { DataEngine } from '../sources/types'
import enrollments from './__tests__/fixtures/immunisation-enrollments.json'
import immunisation from './__tests__/fixtures/immunisation-program.json'
import {
    BCG,
    DOSE,
    DPT_1,
    FIRST_NAME,
    NGELEHUN,
    PROGRAM,
    VACCINATION,
    VACCINE,
    edit,
    engineFor,
    enrolledAs,
    immunisationRegister,
} from './__tests__/registerRig'
import { OPV, PERSON, restoredDose, restoring } from './__tests__/restoreRig'

/** What a reload restores of saved events DHIS2 ranks anew, of stages the user may not write, and when DHIS2 is slow. */

type Request = Parameters<DataEngine['query']>[0]

/** Fatmata's BCG dose, ImmEvt00006, as typed into the DPT 1 column before Capture changed its values to BCG 0. */
const RANKED_ELSEWHERE: EventRecord = {
    ...restoredDose('ImmEnr00030', DPT_1),
    id: 'ImmEvt00006',
}
const FATMATA_HELD = {
    enrollment: 'ImmEnr00030',
    program: PROGRAM,
    status: 'ACTIVE',
    events: [
        {
            event: RANKED_ELSEWHERE.id,
            programStage: VACCINATION,
            occurredAt: '2026-10-16T00:00:00.000',
            dataValues: [
                { dataElement: VACCINE, value: 'BCG' },
                { dataElement: DOSE, value: '0' },
            ],
        },
    ],
}

/** `outbox`'s one change to `event`, which DHIS2 holds, is saved as an update of it: nothing refuses it. */
const expectUpdated = async (
    source: ReturnType<typeof immunisationRegister>,
    outbox: OutboxRecord[],
    form: Awaited<ReturnType<typeof source.load>>,
    event: EventRecord
) => {
    const fake = trackerEngine({
        events: [
            {
                event: event.id,
                program: PROGRAM,
                programStage: VACCINATION,
                orgUnit: NGELEHUN,
                enrollment: event.enrollmentId,
                status: 'COMPLETED',
                occurredAt: '2026-10-16T00:00:00.000',
            },
        ],
    })
    const outcomes = await source.save(fake.engine, outbox, form)
    expect(outcomes.map(({ result }) => result)).toEqual(['saved'])
    expect(fake.sent()).toEqual([
        {
            events: [
                expect.objectContaining({
                    event: event.id,
                    status: 'COMPLETED',
                }),
            ],
        },
    ])
}

test('a saved dose DHIS2 ranks in another slot, on a page not loaded yet, is an ordinary update', async () => {
    const outbox = [edit(RANKED_ELSEWHERE, EVENT_DATE_COLUMN, '2026-10-17')]
    const source = immunisationRegister()
    const firstTwo = {
        enrollments: { enrollments: enrollments.enrollments.slice(0, 2) },
    }
    await source.load(engineFor(firstTwo).engine)
    // DHIS2 fills Fatmata's DPT 1 with another event: the change is still not refused for its slot.
    const held = {
        enrollments: [
            {
                ...FATMATA_HELD,
                events: [
                    ...FATMATA_HELD.events,
                    {
                        event: 'ImmEvt00097',
                        programStage: VACCINATION,
                        occurredAt: '2026-10-20T00:00:00.000',
                        dataValues: [
                            { dataElement: VACCINE, value: 'DPT' },
                            { dataElement: DOSE, value: '1' },
                        ],
                    },
                ],
            },
        ],
    }
    const form = await source.load(engineFor(firstTwo).engine)
    const { rows } = await source.restoreRows(
        engineFor({ ...firstTwo, held }).engine,
        outbox,
        form
    )
    expect(rows).toEqual([])
    await expectUpdated(source, outbox, form, RANKED_ELSEWHERE)
})

test('a saved dose its page shows in another slot is never placed twice or refused', async () => {
    const outbox = [edit(RANKED_ELSEWHERE, EVENT_DATE_COLUMN, '2026-10-17')]
    const source = immunisationRegister()
    const firstTwo = {
        enrollments: { enrollments: enrollments.enrollments.slice(0, 2) },
    }
    const form = await source.load(engineFor(firstTwo).engine)
    await source.restoreRows(
        engineFor({ ...firstTwo, held: { enrollments: [FATMATA_HELD] } })
            .engine,
        outbox,
        form
    )
    // Her page loads: the dose shows where DHIS2 ranks it, and her DPT 1 stays her own empty slot.
    const again = await source.load(engineFor().engine)
    const fatmata = again.tables[0].rows.find(({ id }) => id === 'ImmEnr00030')
    expect(fatmata?.slots?.[BCG]).toBe(RANKED_ELSEWHERE.id)
    expect(fatmata?.slots?.[DPT_1]).not.toBe(RANKED_ELSEWHERE.id)
    await expectUpdated(source, outbox, again, RANKED_ELSEWHERE)
})

test('a saved event of a loaded person that no column shows is not restored into a slot', async () => {
    // Amara's measles dose, which the layout has no column for, was typed as her DPT 1 before Capture changed it.
    const measles = { ...restoredDose('ImmEnr00010', DPT_1), id: 'ImmEvt00098' }
    const outbox = [edit(measles, EVENT_DATE_COLUMN, '2026-10-30')]
    const { source, form, rows } = await restoring(outbox, {
        enrollments: enrolledAs((enrollment, at) =>
            at === 0
                ? {
                      ...enrollment,
                      events: [
                          ...enrollment.events,
                          {
                              ...enrollment.events[0],
                              event: measles.id,
                              dataValues: [
                                  { dataElement: VACCINE, value: 'MEASLES' },
                                  { dataElement: DOSE, value: '1' },
                              ],
                          },
                      ],
                  }
                : enrollment
        ),
    })
    expect(rows).toEqual([])
    expect(form.tables[0].rows[0].slots?.[DPT_1]).not.toBe(measles.id)
    await expectUpdated(source, outbox, form, measles)
})

test('a restored person’s events in a stage the user may not enter data in are read-only', async () => {
    const { readOnlyRecords } = await restoring(
        [
            edit(PERSON, FIRST_NAME, 'Isatu'),
            edit(OPV, EVENT_DATE_COLUMN, '2026-10-21'),
        ],
        {
            program: {
                ...immunisation,
                programStages: immunisation.programStages.map((stage) => ({
                    ...stage,
                    access: { data: { write: false } },
                })),
            },
        }
    )
    expect(readOnlyRecords?.get(OPV.id)).toBe(
        'You do not have access to enter data in this stage'
    )
    expect(readOnlyRecords?.has(PERSON.id)).toBe(false)
})

test('a reload waits 15 seconds for DHIS2 before its unsent changes wait unchecked', async () => {
    vi.useFakeTimers()
    try {
        const source = immunisationRegister()
        const form = await source.load(engineFor().engine)
        const { engine } = engineFor()
        // SAFETY: the source calls only `query` and `mutate`. DHIS2 never answers the lookup; the platform rejects an
        // aborted request so.
        const silent = {
            query: (request: Request, options?: { signal?: AbortSignal }) =>
                'held' in request
                    ? new Promise((_, reject) =>
                          options?.signal?.addEventListener('abort', () =>
                              reject(
                                  Object.assign(new Error('Aborted'), {
                                      type: 'aborted',
                                  })
                              )
                          )
                      )
                    : engine.query(request, options),
            mutate: engine.mutate,
        } as DataEngine
        let done = false
        const restoring = source
            .restoreRows(
                silent,
                [
                    edit(PERSON, FIRST_NAME, 'Isatu'),
                    edit(OPV, EVENT_DATE_COLUMN, '2026-10-21'),
                ],
                form
            )
            .finally(() => {
                done = true
            })
        await vi.advanceTimersByTimeAsync(14_999)
        expect(done).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        const { readOnlyRecords } = await restoring
        expect(readOnlyRecords?.get(PERSON.id)).toBe(
            'Not checked with DHIS2 yet. Reload the page when you are online.'
        )
    } finally {
        vi.useRealTimers()
    }
})
