import { buildRecord } from '../buildRecord'
import { enrollmentAllowance } from '../enrollmentAllowance'
import type { ProgramRecord } from '../types'
import { enrollment, enrolled, notEnrolled } from './builders'
import { loadFixtures, PRG_ONCE, PRG_OPEN, sourcesFor } from './loadFixtures'

describe('enrollmentAllowance', () => {
    it('unavailable', () => {
        const program: ProgramRecord = {
            status: 'unavailable',
            programId: 'prg',
            debug: 'x',
        }
        expect(enrollmentAllowance(program)).toEqual({
            allowed: false,
            reason: 'unavailable',
        })
    })

    it('unavailable for a program whose metadata failed to load', () => {
        const program: ProgramRecord = {
            status: 'error',
            programId: 'prg',
            error: new Error('x'),
            retry: () => {},
        }
        expect(enrollmentAllowance(program)).toEqual({
            allowed: false,
            reason: 'unavailable',
        })
    })

    it('no-write-access', () => {
        const program = notEnrolled('prg', { access: { canWrite: false } })
        expect(enrollmentAllowance(program)).toEqual({
            allowed: false,
            reason: 'no-write-access',
        })
    })

    it('active-enrollment-exists', () => {
        const program = enrolled('prg', [
            enrollment('a'),
            enrollment('b', { status: 'COMPLETED' }),
        ])
        expect(enrollmentAllowance(program)).toEqual({
            allowed: false,
            reason: 'active-enrollment-exists',
        })
    })

    it('only-enroll-once', () => {
        const program = enrolled(
            'prg',
            [enrollment('a', { status: 'COMPLETED' })],
            { program: { onlyEnrollOnce: true } }
        )
        expect(enrollmentAllowance(program)).toEqual({
            allowed: false,
            reason: 'only-enroll-once',
        })
    })

    it('allowed for a not-enrolled program with write access', () => {
        expect(enrollmentAllowance(notEnrolled('prg'))).toEqual({
            allowed: true,
        })
    })

    it('allowed again after a completed enrollment when it can repeat', () => {
        const program = enrolled('prg', [
            enrollment('a', { status: 'COMPLETED' }),
        ])
        expect(enrollmentAllowance(program)).toEqual({
            allowed: true,
        })
    })

    it('no-write-access wins over an active enrollment and only-enroll-once', () => {
        const program = enrolled('prg', [enrollment('a')], {
            program: { onlyEnrollOnce: true },
            access: { canWrite: false },
        })
        expect(enrollmentAllowance(program)).toEqual({
            allowed: false,
            reason: 'no-write-access',
        })
    })

    it('active-enrollment-exists wins over only-enroll-once', () => {
        const program = enrolled('prg', [enrollment('a')], {
            program: { onlyEnrollOnce: true },
        })
        expect(enrollmentAllowance(program)).toEqual({
            allowed: false,
            reason: 'active-enrollment-exists',
        })
    })

    describe('the seeded P1 record', () => {
        const built = buildRecord(sourcesFor(loadFixtures('v42'), 'P1'))
        const programOf = (id: string) => {
            const program = built.programs.get(id)
            if (!program) throw new Error(`${id} missing`)
            return program
        }

        it('only-enroll-once in Prg002', () => {
            expect(enrollmentAllowance(programOf(PRG_ONCE))).toEqual({
                allowed: false,
                reason: 'only-enroll-once',
            })
        })

        it('active-enrollment-exists in Prg001', () => {
            expect(enrollmentAllowance(programOf(PRG_OPEN))).toEqual({
                allowed: false,
                reason: 'active-enrollment-exists',
            })
        })
    })
})
