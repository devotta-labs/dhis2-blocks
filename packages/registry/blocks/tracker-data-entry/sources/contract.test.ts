// @vitest-environment node
import { it } from 'vitest'
import {
    programEditSchema,
    registerAnswerSchema,
} from '../register/registerLoad'
import * as restore from '../register/restore'
import { eventFormSchema } from './eventSchemas'
import * as save from './trackerSave'

const dir = './__tests__/fixtures/contract'
const load = async (version: string, name: string) =>
    (await import(`${dir}/${version}/${name}.json`)).default

// Each version's captures, parsed by the schemas that read them, wrapped as each query nests them.
it.each(['41', '42', '43'])(
    'the %s captures parse with the blocks’ schemas',
    async (v) => {
        const [page, program, me, systemInfo] = await Promise.all([
            load(v, 'events-page'),
            load(v, 'events-program'),
            load(v, 'events-me'),
            load(v, 'events-system-info'),
        ])
        eventFormSchema.parse({ program, events: page, me, systemInfo })

        const held = async (name: string) => ({ current: await load(v, name) })
        save.heldEventsSchema.parse(await held('held-events'))
        save.heldEnrollmentsSchema.parse(await held('held-enrollments'))
        save.heldPeopleSchema.parse(await held('held-people'))

        registerAnswerSchema.parse({
            enrollments: await load(v, 'register-enrollments'),
            me,
            systemInfo,
        })
        programEditSchema.parse(await load(v, 'register-program'))

        const restored = async (name: string) => ({ held: await load(v, name) })
        restore.heldPeopleSchema.parse(await restored('restore-people'))
        restore.heldEnrollmentsSchema.parse(
            await restored('restore-enrollments')
        )
    }
)

it('the 42 captures carry an event’s assigned user and a person’s duplicate flag through the schemas', async () => {
    const events = save.heldEventsSchema.parse({
        current: await load('42', 'held-events'),
    }).current.events
    expect(
        events.find(({ event }) => event === 'Ae2Throw002')?.assignedUser
    ).toEqual({ uid: 'xE7jOejl9FI', username: 'admin' })
    const people = save.heldPeopleSchema.parse({
        current: await load('42', 'held-people'),
    }).current.trackedEntities
    // No person on the server is flagged (a write would flag one): the key and its type are what is pinned.
    expect(
        people.find(({ trackedEntity }) => trackedEntity === 'Pe1Throw001')
            ?.potentialDuplicate
    ).toBe(false)
})

it('a held event assigned to a user without a username still reads, and keeps the user', async () => {
    const capture = await load('42', 'held-events')
    const [assigned, ...rest] = capture.events
    const held = save.heldEventsSchema.parse({
        current: {
            ...capture,
            events: [
                {
                    ...assigned,
                    assignedUser: { uid: assigned.assignedUser.uid },
                },
                ...rest,
            ],
        },
    }).current.events
    expect(held[0].assignedUser).toEqual({ uid: 'xE7jOejl9FI' })
})
