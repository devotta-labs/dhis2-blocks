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
