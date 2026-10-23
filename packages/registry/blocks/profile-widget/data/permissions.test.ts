import {
    parseProgram,
    parseRecord,
    parseTrackedEntityType,
    programJson,
    recordJson,
    trackedEntityTypeJson,
} from './__tests__/fixtures'
import { resolveProfilePermissions } from './permissions'

const resolve = (
    options: {
        enableChangeLog?: boolean
        trackedEntityTypeWrite?: boolean
        programWrite?: boolean
        withProgram?: boolean
        inactive?: boolean
        orgUnit?: string | null
        authorities?: readonly string[]
    } = {}
) => {
    const program = parseProgram(
        programJson({
            enableChangeLog: options.enableChangeLog,
            trackedEntityTypeWrite: options.trackedEntityTypeWrite,
            programWrite: options.programWrite,
        })
    )
    return resolveProfilePermissions({
        trackedEntityType:
            options.withProgram === false
                ? parseTrackedEntityType(
                      trackedEntityTypeJson({
                          enableChangeLog: options.enableChangeLog,
                          write: options.trackedEntityTypeWrite,
                      })
                  )
                : program.trackedEntityType,
        trackedEntityTypeName: 'Person',
        program: options.withProgram === false ? null : program,
        record: parseRecord(
            recordJson({ inactive: options.inactive, orgUnit: options.orgUnit })
        ),
        authorities: options.authorities ?? ['F_TEI_CASCADE_DELETE'],
    })
}

const available = { status: 'available' }
const unavailable = { status: 'unavailable' }

describe('resolveProfilePermissions', () => {
    it('allows everything for a writer with the cascade-delete authority', () => {
        expect(resolve({ enableChangeLog: true })).toEqual({
            changelog: available,
            setInactive: available,
            delete: available,
        })
        expect(resolve({ authorities: ['ALL'] }).delete).toEqual(available)
    })

    it.each([
        [undefined, unavailable],
        [false, unavailable],
        [true, available],
    ])(
        'changelog with enableChangeLog %j is %j',
        (enableChangeLog, expected) => {
            expect(resolve({ enableChangeLog }).changelog).toEqual(expected)
            expect(
                resolve({ enableChangeLog, withProgram: false }).changelog
            ).toEqual(expected)
        }
    )

    it('needs TET data write and an org unit to set inactive', () => {
        expect(resolve({ trackedEntityTypeWrite: false }).setInactive).toEqual(
            unavailable
        )
        expect(resolve({ orgUnit: null }).setInactive).toEqual(unavailable)
        expect(resolve({ programWrite: false }).setInactive).toEqual(available)
    })

    it('still offers setInactive on an inactive entity, so it can be activated', () => {
        expect(resolve({ inactive: true }).setInactive).toEqual(available)
    })

    it('hides delete without TET write, program write or while inactive', () => {
        expect(resolve({ trackedEntityTypeWrite: false }).delete).toEqual(
            unavailable
        )
        expect(resolve({ programWrite: false }).delete).toEqual(unavailable)
        expect(resolve({ inactive: true }).delete).toEqual(unavailable)
    })

    it('ignores program write without a program', () => {
        expect(
            resolve({ programWrite: false, withProgram: false }).delete
        ).toEqual(available)
    })

    it('disables delete with a reason without the cascade-delete authority', () => {
        expect(resolve({ authorities: ['F_TEI_DELETE'] }).delete).toEqual({
            status: 'disabled',
            reason: 'You do not have access to delete this Person',
        })
    })
})
