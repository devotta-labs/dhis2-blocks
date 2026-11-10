import React, { type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import childPerson from '../api/__fixtures__/trackedEntity.child.json'
import childProgram from '../api/__fixtures__/program.child.json'
import rmnchPerson from '../api/__fixtures__/trackedEntity.rmnch.json'
import rmnchProgram from '../api/__fixtures__/program.rmnch.json'
import personType from '../api/__fixtures__/trackedEntityType.person.json'
import { createTrackedEntityHeaderClient } from '../api/client'
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
interface RawMetaAttribute {
    trackedEntityAttribute: { id: string; optionSet?: unknown }
}
/** The parts of a recorded response the tests edit. */
export interface RawPerson {
    attributes: RawAttribute[]
    enrollments: unknown[]
    trackedEntity?: string
}
export interface RawProgram {
    programTrackedEntityAttributes: RawMetaAttribute[]
}

export type Edit<T> = (raw: T) => T

export type Status = 'ready' | 'loading' | 'failed' | 'restricted'

/** RMNCH Linda Bailey or Child John Kelly, with the person or program edited, or a request that never answers or fails. */
export const renderParts = async (
    children: ReactNode,
    {
        program = RMNCH,
        status = 'ready',
        person = (raw) => raw,
        metadata = (raw) => raw,
    }: {
        program?: string | null
        status?: Status
        person?: Edit<RawPerson>
        metadata?: Edit<RawProgram>
    } = {}
) => {
    const isChild = program === CHILD
    const client = createTrackedEntityHeaderClient({
        query: async (query) => {
            const [[key, request]] = Object.entries(query)
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
            if (status === 'failed' || status === 'restricted') {
                throw Object.assign(new Error('no'), {
                    httpStatusCode: status === 'failed' ? 500 : 403,
                })
            }
            return {
                [key]: z.json().parse(
                    person({
                        ...(isChild ? childPerson : rmnchPerson),
                        trackedEntity: request.id,
                    })
                ),
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
