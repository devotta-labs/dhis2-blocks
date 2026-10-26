import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { z } from 'zod'
import { RMNCH, rmnchEnrollmentResponse, type rmnchResponses } from './rmnch'

interface RawRules {
    programRules: ReadonlyArray<{
        id: string
        name: string
        condition: string
        programStage?: { id: string }
        programRuleActions: ReadonlyArray<{
            id: string
            programRuleActionType: string
            dataElement?: { id: string }
            optionGroup?: {
                id: string
                options: ReadonlyArray<{ code: string }>
            }
        }>
    }>
}
type Responses = Omit<typeof rmnchResponses, 'rules'> & {
    rules: RawRules
}

type Singular = string | number | boolean
type RequestedParam =
    | Singular
    | Record<string, Singular>
    | Array<Singular | Record<string, Singular>>
    | undefined

interface RequestedResource {
    id?: string
    params?: Record<string, RequestedParam>
}

/** A second person the fake server knows, with the RMNCH data. */
export const SECOND_PERSON = 'PE2ndPerson'

const people = [RMNCH.enrollmentId, SECOND_PERSON]

/** What `tracker/enrollments` answers: the enrollment asked for by id, or a list of the known people among those asked for. */
const enrollmentsAnswer = (query: RequestedResource) =>
    query.id !== undefined
        ? rmnchEnrollmentResponse
        : {
              pager: { page: 1, pageSize: 50 },
              enrollments: String(query.params?.enrollments)
                  .split(',')
                  .filter((id) => people.includes(id))
                  .map((id) => ({
                      ...rmnchEnrollmentResponse,
                      enrollment: id,
                  })),
          }

/** The RMNCH program served through the app-runtime, with every request recorded by resource name. */
export const serve = (
    responses: Responses,
    initiallyFailing: ReadonlyArray<string> = []
) => {
    const requests: string[] = []
    const failing = [...initiallyFailing]
    const holds = new Map<string, Promise<void>>()
    /** Makes the answers of a resource wait until the returned function is called. */
    const hold = (name: string): (() => void) => {
        let release: (() => void) | undefined
        holds.set(
            name,
            new Promise<void>((resolve) => {
                release = () => resolve()
            })
        )
        return () => {
            holds.delete(name)
            release?.()
        }
    }
    const resource =
        <T,>(name: string, body: (query: RequestedResource) => T) =>
        async (_type: string, query: RequestedResource) => {
            requests.push(name)
            await holds.get(name)
            if (failing.includes(name)) {
                // An access error, so the hook's retry policy doesn't retry it.
                throw new FetchError({
                    type: 'access',
                    message: `${name} failed`,
                })
            }
            // Served as it would arrive over the wire: plain JSON, no `undefined` members.
            return z.json().parse(JSON.parse(JSON.stringify(body(query))))
        }
    const data = {
        programRules: resource('programRules', () => responses.rules),
        programRuleVariables: resource(
            'programRuleVariables',
            () => responses.variables
        ),
        constants: resource('constants', () => responses.constants),
        programs: resource('programs', () => responses.program),
        me: resource('me', () => responses.me),
        organisationUnitGroups: resource('organisationUnitGroups', () => ({
            organisationUnitGroups: [
                {
                    id: 'EYbopBOJWsW',
                    code: 'MCHP',
                    organisationUnits: [{ id: 'm7fBMpmVpSM' }],
                },
            ],
        })),
        'tracker/enrollments': resource(
            'tracker/enrollments',
            enrollmentsAnswer
        ),
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { requests, wrapper, failing, queryClient, hold }
}
