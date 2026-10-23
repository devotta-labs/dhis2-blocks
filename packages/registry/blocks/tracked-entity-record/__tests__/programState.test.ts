import {
    ownerInUserScope,
    ownerOrgUnitsToCheck,
    programIdsToLoad,
    resolveProgramState,
    toOwnerPaths,
    toUserScopes,
    type RecordSources,
} from '../programState'
import type { ProgramRecord } from '../types'
import {
    loadFixtures,
    PRG_ONCE,
    PRG_OPEN,
    PRG_PROTECTED,
    sourcesFor,
    withProgram,
} from './loadFixtures'

const v42 = loadFixtures('v42')

const FACILITY_A = 'DiszpKrYNg8'
const FACILITY_B = 'FLjwMPWLrL2'

const expectUnavailable = (state: ProgramRecord) => {
    expect(state.status).toBe('unavailable')
    if (state.status === 'unavailable') {
        expect(state.debug.length).toBeGreaterThan(0)
    }
}

describe('resolveProgramState', () => {
    it('enrolled in Prg001 with two enrollments, newest first', () => {
        const state = resolveProgramState(PRG_OPEN, sourcesFor(v42, 'P1'))

        expect(state.status).toBe('enrolled')
        if (state.status !== 'enrolled') return
        expect(state.enrollments.map((enrollment) => enrollment.id)).toEqual([
            'TrE2eEnr002',
            'TrE2eEnr001',
        ])
        expect(state.program.owner).toBe(FACILITY_A)
        expect(state.access.canWrite).toBe(true)
    })

    it('not-enrolled when readable, same type, no enrollment and no owner', () => {
        const state = resolveProgramState(PRG_ONCE, sourcesFor(v42, 'P2'))

        expect(state.status).toBe('not-enrolled')
        if (state.status !== 'not-enrolled') return
        expect(state.program.id).toBe(PRG_ONCE)
        expect(state.program.owner).toBeUndefined()
    })

    it('not-enrolled with no owner row needs no scope lookups', () => {
        const {
            scopes: _scopes,
            ownerPaths: _paths,
            ...sources
        } = sourcesFor(v42, 'P2')

        expect(resolveProgramState(PRG_ONCE, sources).status).toBe(
            'not-enrolled'
        )
    })

    it.each(['PROTECTED', 'CLOSED'] as const)(
        'unavailable when the owner is outside capture scope for %s',
        (accessLevel) => {
            const sources: RecordSources = {
                ...sourcesFor(v42, 'P1'),
                programs: withProgram(v42.programs, PRG_PROTECTED, (p) => ({
                    ...p,
                    accessLevel,
                })),
            }

            expectUnavailable(resolveProgramState(PRG_PROTECTED, sources))
        }
    )

    it('unavailable when the owner is outside capture scope for PROTECTED (P1 / Prg003)', () => {
        expectUnavailable(
            resolveProgramState(PRG_PROTECTED, sourcesFor(v42, 'P1'))
        )
    })

    it('not-enrolled when the owner is in capture scope and the enrollment was deleted', () => {
        const state = resolveProgramState(PRG_OPEN, sourcesFor(v42, 'P3'))

        expect(state.status).toBe('not-enrolled')
        if (state.status !== 'not-enrolled') return
        expect(state.program.owner).toBe(FACILITY_A)
        expect(state.access.canWrite).toBe(true)
    })

    it.each(['OPEN', 'AUDITED'] as const)(
        '%s owner in search scope only is not-enrolled',
        (accessLevel) => {
            const sources: RecordSources = {
                ...sourcesFor(v42, 'P1'),
                programs: withProgram(v42.programs, PRG_PROTECTED, (p) => ({
                    ...p,
                    accessLevel,
                })),
            }

            const state = resolveProgramState(PRG_PROTECTED, sources)

            expect(state.status).toBe('not-enrolled')
            if (state.status !== 'not-enrolled') return
            expect(state.program.owner).toBe(FACILITY_B)
        }
    )

    it('OPEN owner outside both scopes is unavailable', () => {
        const sources: RecordSources = {
            ...sourcesFor(v42, 'P1'),
            programs: withProgram(v42.programs, PRG_PROTECTED, (p) => ({
                ...p,
                accessLevel: 'OPEN',
            })),
            scopes: { capture: new Set(['X']), search: new Set(['Y']) },
        }

        expectUnavailable(resolveProgramState(PRG_PROTECTED, sources))
    })

    it('unavailable when the owner needs checking and the scopes are not loaded', () => {
        const { scopes: _scopes, ...sources } = sourcesFor(v42, 'P3')

        expectUnavailable(resolveProgramState(PRG_OPEN, sources))
    })

    it("unavailable when the owner's path is not loaded", () => {
        const sources: RecordSources = {
            ...sourcesFor(v42, 'P3'),
            ownerPaths: new Map(),
        }

        expectUnavailable(resolveProgramState(PRG_OPEN, sources))
    })

    it('unavailable when metadata is missing', () => {
        expectUnavailable(
            resolveProgramState('TrE2ePrg999', sourcesFor(v42, 'P1'))
        )
    })

    it('unavailable without data read', () => {
        const sources: RecordSources = {
            ...sourcesFor(v42, 'P1'),
            programs: withProgram(v42.programs, PRG_OPEN, (p) => ({
                ...p,
                access: { data: { read: false, write: false } },
            })),
        }

        expectUnavailable(resolveProgramState(PRG_OPEN, sources))
    })

    it('unavailable for a program of another tracked entity type', () => {
        const sources: RecordSources = {
            ...sourcesFor(v42, 'P1'),
            programs: withProgram(v42.programs, PRG_OPEN, (p) => ({
                ...p,
                trackedEntityType: { id: 'TrE2eTet999' },
            })),
        }

        expectUnavailable(resolveProgramState(PRG_OPEN, sources))
    })

    it('unavailable for an event program', () => {
        const sources: RecordSources = {
            ...sourcesFor(v42, 'P1'),
            programs: withProgram(v42.programs, PRG_OPEN, (p) => ({
                ...p,
                programType: 'WITHOUT_REGISTRATION',
                trackedEntityType: undefined,
            })),
        }

        expectUnavailable(resolveProgramState(PRG_OPEN, sources))
    })

    it('error for every program when the programs request failed', () => {
        const error = new Error('programs failed')
        const retry = vi.fn()
        const sources: RecordSources = {
            ...sourcesFor(v42, 'P1'),
            programsError: { error, retry },
        }

        for (const programId of [
            PRG_OPEN,
            PRG_ONCE,
            PRG_PROTECTED,
            'TrE2ePrg999',
        ]) {
            const state = resolveProgramState(programId, sources)
            expect(state).toEqual({
                status: 'error',
                programId,
                error,
                retry: expect.any(Function),
            })
            if (state.status === 'error') state.retry()
        }
        expect(retry).toHaveBeenCalledTimes(4)
    })
})

describe('ownerInUserScope', () => {
    const scopes = {
        capture: new Set([FACILITY_A]),
        search: new Set(['O6uvpzGd5pu']),
    }
    const facilityBPath = '/ImspTQPwCqd/O6uvpzGd5pu/npWGUj37qDe/FLjwMPWLrL2'

    it.each([
        ['OPEN', true],
        ['AUDITED', true],
        ['PROTECTED', false],
        ['CLOSED', false],
    ] as const)(
        'an owner under the search scope only, %s: %s',
        (level, inScope) => {
            expect(ownerInUserScope(facilityBPath, level, scopes)).toBe(inScope)
        }
    )

    it('an owner under the capture scope is in scope for every level', () => {
        const path = '/ImspTQPwCqd/O6uvpzGd5pu/YuQRtpLP10I/DiszpKrYNg8'
        for (const level of [
            'OPEN',
            'AUDITED',
            'PROTECTED',
            'CLOSED',
        ] as const) {
            expect(ownerInUserScope(path, level, scopes)).toBe(true)
        }
    })

    it('matches whole ids on the path, not substrings', () => {
        expect(
            ownerInUserScope('/ImspTQPwCqd/DiszpKrYNg8x', 'OPEN', scopes)
        ).toBe(false)
    })
})

describe('scope lookups', () => {
    it('toUserScopes keeps capture and search ids apart', () => {
        expect(toUserScopes(v42.userScopes)).toEqual({
            capture: new Set([FACILITY_A]),
            search: new Set(['O6uvpzGd5pu']),
        })
    })

    it('toOwnerPaths maps each org unit to its path', () => {
        expect(toOwnerPaths(v42.orgUnitPaths)).toEqual(
            new Map([
                [
                    FACILITY_B,
                    '/ImspTQPwCqd/O6uvpzGd5pu/npWGUj37qDe/FLjwMPWLrL2',
                ],
                [
                    FACILITY_A,
                    '/ImspTQPwCqd/O6uvpzGd5pu/YuQRtpLP10I/DiszpKrYNg8',
                ],
            ])
        )
    })
})

describe('programIdsToLoad', () => {
    it('is the visible enrollments and owner rows, deduplicated and sorted', () => {
        expect(programIdsToLoad(v42.persons.P1)).toEqual([
            PRG_OPEN,
            PRG_ONCE,
            PRG_PROTECTED,
        ])
        expect(programIdsToLoad(v42.persons.P3)).toEqual([PRG_OPEN])
    })

    it('is the requested programs when given', () => {
        expect(
            programIdsToLoad(v42.persons.P1, [PRG_ONCE, 'Zz', PRG_ONCE])
        ).toEqual([PRG_ONCE, 'Zz'])
    })
})

describe('ownerOrgUnitsToCheck', () => {
    it('is the owner of a program with an owner row and no visible enrollment', () => {
        expect(ownerOrgUnitsToCheck(v42.persons.P1, v42.programs)).toEqual([
            FACILITY_B,
        ])
        expect(ownerOrgUnitsToCheck(v42.persons.P3, v42.programs)).toEqual([
            FACILITY_A,
        ])
    })

    it('is empty when every owned program has a visible enrollment', () => {
        expect(ownerOrgUnitsToCheck(v42.persons.P2, v42.programs)).toEqual([])
    })

    it('only looks at the requested programs', () => {
        expect(
            ownerOrgUnitsToCheck(v42.persons.P1, v42.programs, [PRG_OPEN])
        ).toEqual([])
        expect(
            ownerOrgUnitsToCheck(v42.persons.P1, v42.programs, [PRG_PROTECTED])
        ).toEqual([FACILITY_B])
    })

    it('skips programs that are unavailable before the owner matters', () => {
        const unreadable = withProgram(v42.programs, PRG_PROTECTED, (p) => ({
            ...p,
            access: { data: { read: false, write: false } },
        }))

        expect(ownerOrgUnitsToCheck(v42.persons.P1, unreadable)).toEqual([])
    })
})
