import React, { type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import childPerson from '../api/__fixtures__/trackedEntity.child.json'
import childProgram from '../api/__fixtures__/program.child.json'
import noProgramPerson from '../api/__fixtures__/trackedEntity.noProgram.json'
import rmnchPerson from '../api/__fixtures__/trackedEntity.rmnch.json'
import rmnchProgram from '../api/__fixtures__/program.rmnch.json'
import personType from '../api/__fixtures__/trackedEntityType.person.json'
import orgUnit from '../api/__fixtures__/organisationUnit.json'
import {
    createTrackedEntityHeaderClient,
    type ResourceRequest,
} from '../api/client'
import { TrackedEntityHeaderProvider } from '../provider/TrackedEntityHeaderProvider'
import { CHILD, createWrapper, RMNCH } from './headerTestSupport'

export const FIRST = 'w75KJ2mc4zz'
export const LAST = 'zDhUuAYrxNC'
export const ALLERGIES = 'gu1fqsmoU8r'
export const BIRTH_DATE = 'gHGyrwKPzej'
export const CITY = 'FO4sWYJ64LQ'
export { CHILD, RMNCH }

interface RawAttribute {
    attribute: string
    value?: string
}
interface RawEnrollment {
    status: string
    enrolledAt?: string
    completedAt?: string
}
interface RawMetaAttribute {
    trackedEntityAttribute: { id: string; optionSet?: unknown }
}
/** The parts of a recorded response the tests edit. */
export interface RawPerson {
    attributes: RawAttribute[]
    enrollments: RawEnrollment[]
    trackedEntity?: string
    inactive?: boolean
    potentialDuplicate?: boolean
}
export interface RawProgram {
    programTrackedEntityAttributes: RawMetaAttribute[]
    trackedEntityType?: { displayName: string }
}

export type Edit<T> = (raw: T) => T

export type Status = 'ready' | 'loading' | 'failed' | 'restricted' | 'not-found'

/** RMNCH Linda Bailey or Child John Kelly, with the person or program edited, or a request that never answers or fails. Not `enrolled`, Linda Bailey in any program. */
export const renderParts = async (
    children: ReactNode,
    {
        program = RMNCH,
        status = 'ready',
        person = (raw) => raw,
        metadata = (raw) => raw,
        orgUnitStatus = 'ready',
        enrolled = true,
        requests = [],
    }: {
        program?: string | null
        status?: Status
        person?: Edit<RawPerson>
        metadata?: Edit<RawProgram>
        /** The organisation unit request: answered, never answered, or failed. */
        orgUnitStatus?: 'ready' | 'loading' | 'failed'
        /** False: the person request with a program answers 404, as DHIS2 does for a person not enrolled in it. */
        enrolled?: boolean
        /** Collects every request the client made. */
        requests?: ResourceRequest[]
    } = {}
) => {
    const isChild = program === CHILD
    const client = createTrackedEntityHeaderClient({
        query: async (query) => {
            const [[key, request]] = Object.entries(query)
            requests.push(request)
            if (request.resource === 'organisationUnits') {
                if (orgUnitStatus === 'loading') {
                    return new Promise(() => {})
                }
                if (orgUnitStatus === 'failed') {
                    throw Object.assign(new Error('no'), {
                        httpStatusCode: 500,
                    })
                }
                return { [key]: orgUnit }
            }
            if (request.resource === 'programs') {
                return {
                    [key]: z
                        .json()
                        .parse(metadata(isChild ? childProgram : rmnchProgram)),
                }
            }
            if (request.resource === 'trackedEntityTypes') {
                return { [key]: personType }
            }
            if (status === 'loading') {
                return new Promise(() => {})
            }
            if (status !== 'ready') {
                const httpStatusCode = {
                    failed: 500,
                    restricted: 403,
                    'not-found': 404,
                }[status]
                throw Object.assign(new Error('no'), { httpStatusCode })
            }
            let raw: RawPerson = isChild ? childPerson : rmnchPerson
            if (!enrolled) {
                if (request.params?.program !== undefined) {
                    throw Object.assign(new Error('Not found'), {
                        httpStatusCode: 404,
                    })
                }
                raw = noProgramPerson
            }
            return {
                [key]: z
                    .json()
                    .parse(person({ ...raw, trackedEntity: request.id })),
            }
        },
    })
    const Wrapper = createWrapper()
    return render(
        <Wrapper>
            <TrackedEntityHeaderProvider
                trackedEntity="k4ODejBytgv"
                program={program ?? undefined}
                client={client}
            >
                {children}
            </TrackedEntityHeaderProvider>
        </Wrapper>
    )
}
