import { SAVED_FUNDED_VISIT, SAVED_VISIT } from '../test/childVisit'
import { childVisitForm } from '../test/forms'
import {
    choiceProblem,
    heldChoices,
    limitedByOrgUnit,
    unavailableOptions,
} from './categories'
import type { OptionScope } from './categories'
import { heldEventSchema } from './metadata'

const [funding, outreach] = childVisitForm({ categories: true }).categories
const AT_THE_CLINIC: OptionScope = {
    orgUnits: new Set(['labCountry1', 'labDistrct1', 'labOrgUnit1']),
    eventDate: '2026-11-02',
    calendar: 'iso8601',
}

describe('unavailableOptions', () => {
    it('leaves out options for another org unit, past their end and not writable', () => {
        expect(unavailableOptions(funding, AT_THE_CLINIC)).toEqual(
            new Set(['labCoDonor1', 'labCoPilot1'])
        )
        expect(unavailableOptions(outreach, AT_THE_CLINIC)).toEqual(
            new Set(['labCoCampgn'])
        )
    })

    it('offers an option limited to an ancestor, and one with no org units anywhere', () => {
        const elsewhere = {
            ...AT_THE_CLINIC,
            orgUnits: new Set(['labOrgUnit9']),
        }
        expect(unavailableOptions(funding, elsewhere).has('labCoGovt01')).toBe(
            false
        )
        expect(unavailableOptions(funding, elsewhere).has('labCoNgo001')).toBe(
            true
        )
    })

    it('includes both ends of an option’s dates', () => {
        expect(
            unavailableOptions(outreach, {
                ...AT_THE_CLINIC,
                eventDate: '2026-01-01',
            }).has('labCoMobile')
        ).toBe(false)
        expect(
            unavailableOptions(funding, {
                ...AT_THE_CLINIC,
                eventDate: '2025-06-30',
            }).has('labCoPilot1')
        ).toBe(false)
        expect(
            unavailableOptions(outreach, {
                ...AT_THE_CLINIC,
                eventDate: '2025-12-31',
            }).has('labCoMobile')
        ).toBe(true)
    })
})

describe('choiceProblem', () => {
    it('says nothing without a choice or for one that applies', () => {
        expect(choiceProblem(funding, undefined, AT_THE_CLINIC)).toBeUndefined()
        expect(
            choiceProblem(funding, 'labCoNgo001', AT_THE_CLINIC)
        ).toBeUndefined()
    })

    it('says plainly why a chosen option does not apply', () => {
        expect(choiceProblem(funding, 'labCoPilot1', AT_THE_CLINIC)).toBe(
            'Pilot grant ended on Jun 30, 2025'
        )
        expect(choiceProblem(funding, 'labCoDonor1', AT_THE_CLINIC)).toBe(
            'Donor project is not used at this org unit'
        )
        expect(choiceProblem(outreach, 'labCoCampgn', AT_THE_CLINIC)).toBe(
            'You cannot enter data for Campaign'
        )
        expect(
            choiceProblem(outreach, 'labCoMobile', {
                ...AT_THE_CLINIC,
                eventDate: '2025-12-31',
            })
        ).toBe('Mobile clinic starts on Jan 1, 2026')
    })
})

describe('heldChoices', () => {
    it('reads the event’s options by category', () => {
        expect(
            heldChoices(heldEventSchema.parse(SAVED_FUNDED_VISIT), [
                funding,
                outreach,
            ])
        ).toEqual({ labCatFund1: 'labCoGovt01', labCatOutr1: 'labCoFixed1' })
    })

    it('reads nothing for a new event or the default combination', () => {
        expect(heldChoices(undefined, [funding, outreach])).toEqual({})
        expect(heldChoices(heldEventSchema.parse(SAVED_VISIT), [])).toEqual({})
    })
})

describe('limitedByOrgUnit', () => {
    it('is whether any option is limited to org units', () => {
        expect(limitedByOrgUnit([funding, outreach])).toBe(true)
        expect(limitedByOrgUnit([outreach])).toBe(false)
    })
})
