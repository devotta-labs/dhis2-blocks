import type {
    DateOf,
    EnrollmentStatus,
    RecordEnrollment,
    RelationshipNode,
} from './model'

export const enrollmentFor = (
    node: RelationshipNode,
    program: string
): RecordEnrollment | undefined =>
    node.state.status === 'loaded'
        ? node.state.record.enrollments.find((e) => e.program === program)
        : undefined

export const isMarkedForFollowUp = (
    node: RelationshipNode,
    program: string
): boolean => enrollmentFor(node, program)?.followUp ?? false

export const enrollmentStatus = (
    node: RelationshipNode,
    program: string
): EnrollmentStatus | undefined => enrollmentFor(node, program)?.status

export const defaultDateOf =
    (program?: string): DateOf =>
    (node) => {
        if (node.state.status !== 'loaded') {
            return undefined
        }
        const { record } = node.state
        const at =
            node.ref.kind === 'event'
                ? record.occurredAt
                : (program === undefined
                      ? record.enrollments[0]
                      : enrollmentFor(node, program)
                  )?.enrolledAt
        const date = at ? new Date(at) : undefined
        return date && !Number.isNaN(date.getTime()) ? date : undefined
    }
