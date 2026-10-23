import type { Enrollment, ProgramRecord } from './types'

/**
 * Spec 8.1, mirroring Capture's AUTO: the selected enrollment when it belongs
 * to the program, else the only one, else the newest ACTIVE one, else
 * `undefined` (several, none active: the host lets the user choose).
 */
export const currentEnrollment = (
    program: ProgramRecord,
    selectedEnrollmentId?: string
): Enrollment | undefined => {
    if (program.status !== 'enrolled') return undefined
    const { enrollments } = program
    const selected =
        selectedEnrollmentId === undefined
            ? undefined
            : enrollments.find(({ id }) => id === selectedEnrollmentId)
    if (selected) return selected
    if (enrollments.length === 1) return enrollments[0]
    return enrollments.find(({ status }) => status === 'ACTIVE')
}
