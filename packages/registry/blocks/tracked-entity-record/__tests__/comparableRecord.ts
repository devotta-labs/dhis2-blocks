import type { Enrollment, ProgramInfo, TrackedEntityRecord } from '../types'

// For comparing records built from different versions' fixtures. Only what
// differs between fresh servers is blanked: server timestamps (createdAt,
// updatedAt, storedAt) and an enrollment's completedAt, which 2.41 stamps with
// the import time instead of the seeded date. Maps become entry lists, so
// their order is compared too.

const SERVER_TIME = '<server time>'
const program = (info: ProgramInfo) => ({
    ...info,
    stages: info.stages.map((stage) => ({
        ...stage,
        dataElements: [...stage.dataElements],
    })),
})
const enrollment = (e: Enrollment) => ({
    ...e,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
    completedAt: e.completedAt === undefined ? undefined : SERVER_TIME,
    attributes: [...e.attributes],
    notes: e.notes.map((note) => ({ ...note, storedAt: SERVER_TIME })),
    events: e.events.map((event) => ({
        ...event,
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
        dataValues: [...event.dataValues],
        notes: event.notes.map((n) => ({
            ...n,
            storedAt: SERVER_TIME,
        })),
    })),
})
export const comparableRecord = (record: TrackedEntityRecord) => ({
    person: {
        ...record.person,
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
        attributes: [...record.person.attributes],
    },
    programs: [...record.programs].map(([id, state]) => [
        id,
        state.status === 'enrolled'
            ? {
                  ...state,
                  program: program(state.program),
                  enrollments: state.enrollments.map(enrollment),
              }
            : state.status === 'not-enrolled'
              ? { ...state, program: program(state.program) }
              : state,
    ]),
    relationships:
        record.relationships.status === 'ready'
            ? record.relationships.relationships.map((r) => ({
                  ...r,
                  createdAt: SERVER_TIME,
                  other: {
                      ...r.other,
                      attributes: [...(r.other.attributes ?? [])],
                  },
              }))
            : record.relationships,
})
