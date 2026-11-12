import React, { type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import childPerson from '../api/__fixtures__/trackedEntity.child.json'
import childProgram from '../api/__fixtures__/program.child.json'
import noProgramPerson from '../api/__fixtures__/trackedEntity.noProgram.json'
import rmnchPerson from '../api/__fixtures__/trackedEntity.rmnch.json'
import rmnchProgram from '../api/__fixtures__/program.rmnch.json'
import personType from '../api/__fixtures__/trackedEntityType.person.json'
import orgUnit from '../api/__fixtures__/organisationUnit.json'
import { TrackedEntityHeaderProvider } from '../provider/TrackedEntityHeaderProvider'
import {
    CHILD,
    createWrapper,
    requestFailure,
    RMNCH,
    serve,
    type HeaderRequest,
} from './headerTestSupport'

const never = () => new Promise<never>(() => {})

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
        /** Collects every request the parts made. */
        requests?: HeaderRequest[]
    } = {}
) => {
    const isChild = program === CHILD
    const data = serve((request) => {
        requests.push(request)
        if (request.resource === 'organisationUnits') {
            if (orgUnitStatus === 'loading') {
                return never()
            }
            if (orgUnitStatus === 'failed') {
                throw requestFailure(500)
            }
            return orgUnit
        }
        if (request.resource === 'programs') {
            return metadata(isChild ? childProgram : rmnchProgram)
        }
        if (request.resource === 'trackedEntityTypes') {
            return personType
        }
        if (status === 'loading') {
            return never()
        }
        if (status !== 'ready') {
            throw requestFailure(
                { failed: 500, restricted: 403, 'not-found': 404 }[status]
            )
        }
        let raw: RawPerson = isChild ? childPerson : rmnchPerson
        if (!enrolled) {
            if (request.params?.program !== undefined) {
                throw requestFailure(404)
            }
            raw = noProgramPerson
        }
        return person({ ...raw, trackedEntity: request.id })
    })
    const Wrapper = createWrapper(data)
    return render(
        <Wrapper>
            <TrackedEntityHeaderProvider
                trackedEntity="k4ODejBytgv"
                program={program ?? undefined}
            >
                {children}
            </TrackedEntityHeaderProvider>
        </Wrapper>
    )
}
