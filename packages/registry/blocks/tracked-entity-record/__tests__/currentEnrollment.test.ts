import { currentEnrollment } from '../currentEnrollment'
import { buildRecord } from '../buildRecord'
import { enrollment, enrolled, notEnrolled } from './builders'
import { loadFixtures, P1, PRG_OPEN, sourcesFor } from './loadFixtures'

describe('currentEnrollment', () => {
    const program = enrolled('prg', [
        enrollment('newest-completed', { status: 'COMPLETED' }),
        enrollment('active'),
        enrollment('older-active-looking', { status: 'CANCELLED' }),
    ])

    it('the selected one when it belongs to the program', () => {
        expect(currentEnrollment(program, 'older-active-looking')?.id).toBe(
            'older-active-looking'
        )
    })

    it('ignores a selected id from another program', () => {
        expect(currentEnrollment(program, 'someone-elses')?.id).toBe('active')
    })

    it('the only enrollment', () => {
        const only = enrolled('prg', [
            enrollment('only', { status: 'COMPLETED' }),
        ])
        expect(currentEnrollment(only)?.id).toBe('only')
    })

    it('the newest ACTIVE of several', () => {
        const several = enrolled('prg', [
            enrollment('completed', { status: 'COMPLETED' }),
            enrollment('active-new'),
            enrollment('active-old'),
        ])
        expect(currentEnrollment(several)?.id).toBe('active-new')
    })

    it('undefined when several and none active', () => {
        const none = enrolled('prg', [
            enrollment('a', { status: 'COMPLETED' }),
            enrollment('b', { status: 'CANCELLED' }),
        ])
        expect(currentEnrollment(none)).toBeUndefined()
    })

    it('undefined for not-enrolled', () => {
        expect(currentEnrollment(notEnrolled('prg'))).toBeUndefined()
    })

    it('undefined for an unavailable program', () => {
        expect(
            currentEnrollment({
                status: 'unavailable',
                programId: 'prg',
                debug: 'x',
            })
        ).toBeUndefined()
    })

    it('P1 in the open program: the ACTIVE enrollment, not the newest listed', () => {
        const record = buildRecord(sourcesFor(loadFixtures('v42'), 'P1'))
        const state = record.programs.get(PRG_OPEN)
        if (state?.status !== 'enrolled') throw new Error(`${P1} not enrolled`)
        expect(currentEnrollment(state)?.id).toBe('TrE2eEnr002')
        expect(currentEnrollment(state, 'TrE2eEnr001')?.id).toBe('TrE2eEnr001')
    })
})
