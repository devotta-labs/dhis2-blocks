import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { createAppWorkingListClient } from '../AppShell/createAppWorkingListClient'
import {
    OrganisationUnitReferenceSchema,
    retryOperationalError,
} from '../AppShell/contextSchemas'

type Client = ReturnType<typeof createAppWorkingListClient>

const STALE_TIME = 5 * 60 * 1000

const StagesSchema = z
    .object({
        programStages: z.array(
            z
                .object({
                    id: z.string().min(1),
                    displayName: z.string(),
                    repeatable: z.boolean().optional(),
                })
                .passthrough()
        ),
    })
    .passthrough()

const EnrollmentSchema = z
    .object({
        enrollment: z.string().min(1),
        trackedEntity: z.string().min(1).optional(),
        orgUnit: z.string().min(1).optional(),
        status: z.string().optional(),
        enrolledAt: z.string().optional(),
    })
    .passthrough()

const EnrollmentsSchema = z
    .object({ enrollments: z.array(EnrollmentSchema) })
    .passthrough()

export type DemoEnrollment = z.infer<typeof EnrollmentSchema>

/** The stages of a program, for the new-event picker and the stage selector. */
export const useProgramStages = (client: Client, programId?: string) =>
    useQuery({
        queryKey: ['event-form-demo', 'stages', programId],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'programs',
                    id: programId,
                    params: {
                        fields: 'programStages[id,displayName,repeatable]',
                    },
                },
                StagesSchema,
                signal
            ),
        select: (data) => data.programStages,
        enabled: Boolean(programId),
        staleTime: STALE_TIME,
        retry: retryOperationalError,
    })

/** The enrollments of a program at one org unit. */
export const useEnrollments = (
    client: Client,
    apiVersion: number,
    programId?: string,
    orgUnitId?: string
) =>
    useQuery({
        queryKey: [
            'event-form-demo',
            'enrollments',
            apiVersion,
            programId,
            orgUnitId,
        ],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'tracker/enrollments',
                    params: {
                        program: programId,
                        // Tracker renamed the enrollment org unit parameters in 42.
                        ...(apiVersion >= 42
                            ? { orgUnits: orgUnitId, orgUnitMode: 'SELECTED' }
                            : { orgUnit: orgUnitId, ouMode: 'SELECTED' }),
                        fields: 'enrollment,trackedEntity,orgUnit,status,enrolledAt',
                        pageSize: 50,
                    },
                },
                EnrollmentsSchema,
                signal
            ),
        select: (data) => data.enrollments,
        enabled: Boolean(programId && orgUnitId),
        staleTime: STALE_TIME,
        retry: retryOperationalError,
    })

/** The chosen enrollment, which may not be among the first page of its org unit's. */
export const useEnrollment = (client: Client, enrollmentId?: string) =>
    useQuery({
        queryKey: ['event-form-demo', 'enrollment', enrollmentId],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'tracker/enrollments',
                    id: enrollmentId,
                    params: {
                        fields: 'enrollment,trackedEntity,orgUnit,status,enrolledAt',
                    },
                },
                EnrollmentSchema,
                signal
            ),
        enabled: Boolean(enrollmentId),
        staleTime: STALE_TIME,
        retry: retryOperationalError,
    })

export const useOrganisationUnitReference = (
    client: Client,
    orgUnitId?: string
) =>
    useQuery({
        queryKey: ['working-list', 'shell', 'selected-org-unit', orgUnitId],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'organisationUnits',
                    id: orgUnitId,
                    params: { fields: 'id,displayName,path' },
                },
                OrganisationUnitReferenceSchema,
                signal
            ),
        enabled: Boolean(orgUnitId),
        staleTime: 60 * 60 * 1000,
        retry: retryOperationalError,
    })
