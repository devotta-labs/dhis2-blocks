import type { EnrollmentAllowance, ProgramRecord } from './types'

/**
 * Spec 9.4: whether a new enrollment may be started in the program, and if
 * not, the first reason that applies, in this order: unavailable, no write
 * access (an inactive person included), an active enrollment, enroll-once.
 */
export const enrollmentAllowance = (
    program: ProgramRecord
): EnrollmentAllowance => {
    if (program.status !== 'enrolled' && program.status !== 'not-enrolled') {
        return { allowed: false, reason: 'unavailable' }
    }
    if (!program.access.canWrite) {
        return { allowed: false, reason: 'no-write-access' }
    }
    if (program.status === 'not-enrolled') return { allowed: true }
    if (program.enrollments.some(({ status }) => status === 'ACTIVE')) {
        return { allowed: false, reason: 'active-enrollment-exists' }
    }
    if (program.program.onlyEnrollOnce && program.enrollments.length > 0) {
        return { allowed: false, reason: 'only-enroll-once' }
    }
    return { allowed: true }
}
