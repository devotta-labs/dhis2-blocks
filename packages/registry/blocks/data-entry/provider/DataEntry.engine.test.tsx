/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import { z } from 'zod'
import { ruleEngineChunk } from '@/components/program-rules/hooks/loadRuleEngine'
import { RMNCH } from '@/components/program-rules/__tests__/rmnch'
import inpatientEvents from '../sources/__tests__/fixtures/inpatient-events.json'
import inpatientProgram from '../sources/__tests__/fixtures/inpatient-program.json'
import meAdmin from '../sources/__tests__/fixtures/me-admin.json'
import { eventSource } from '../sources/eventSource'
import type { LoadedForm } from '../sources/types'
import { cleanUp, memorySource, mount, USER, visitForm } from './__tests__/rig'
import { rulesFor } from './__tests__/rmnchRig'

afterEach(cleanUp)
beforeEach(() => performance.clearMeasures('data-entry:rules'))

/** What the server sends: plain JSON, no `undefined` members. */
const json = <T,>(body: T) => z.json().parse(JSON.parse(JSON.stringify(body)))

const formWith = (hasRules: boolean): LoadedForm => ({
    ...visitForm(),
    rules: {
        programId: RMNCH.programId,
        programStageIds: ['s1'],
        tracker: false,
        enrollmentIds: [],
        hasRules,
    },
})

// The spy sees every import of the engine's chunk; the second test shows it does see one.
test('a program without rules never loads the engine', async () => {
    const load = vi.spyOn(ruleEngineChunk, 'load')
    await mount(memorySource(formWith(false)).source, {
        data: { ...rulesFor(), programRules: { programRules: [] } },
    })
    // The rules are ready once their metadata has said there are none.
    await expect
        .poll(() => performance.getEntriesByName('data-entry:rules', 'measure'))
        .toHaveLength(1)
    expect(load).not.toHaveBeenCalled()
})

test('a program with rules loads the engine as soon as the form says so, before its rules arrive', async () => {
    const load = vi.spyOn(ruleEngineChunk, 'load')
    await mount(memorySource(formWith(true)).source, {
        // The rules never arrive, so only the form's word can have asked for the engine.
        data: {
            ...rulesFor(),
            programRules: () => new Promise<never>(() => {}),
        },
    })
    await expect.poll(() => load.mock.calls.length).toBe(1)
})

/** The inpatient events through the real source, with `programRules` answered as given. */
const mountInpatient = (programRules: () => Promise<never>) =>
    mount(
        eventSource({
            programId: 'eBAyeGv0exc',
            orgUnitId: 'DiszpKrYNg8',
            today: '2026-10-26',
        }),
        {
            data: {
                me: async () => ({
                    id: USER,
                    authorities: meAdmin.authorities,
                }),
                programs: async () => json(inpatientProgram),
                'tracker/events': async () => json(inpatientEvents),
                programRules,
            },
        }
    )

test('a program whose rules cannot be asked about still opens its form, without the engine', async () => {
    const load = vi.spyOn(ruleEngineChunk, 'load')
    const { context } = await mountInpatient(async () => {
        throw new FetchError({ type: 'access', message: 'No access' })
    })
    expect(context().tables[0].rows).toHaveLength(inpatientEvents.events.length)
    expect(load).not.toHaveBeenCalled()
})

test('a question about rules that never answers does not hold the form back', async () => {
    const load = vi.spyOn(ruleEngineChunk, 'load')
    const { context } = await mountInpatient(() => new Promise<never>(() => {}))
    expect(context().tables[0].rows).toHaveLength(inpatientEvents.events.length)
    expect(load).not.toHaveBeenCalled()
})
