import type { ApiChangelogResponse } from '../api/schemas'
import type { ValueFormatter } from '../data/formatting/contracts'
import type { TrackedEntityAttributeField } from '../types'
import {
    changelogFormattableValues,
    formatChangelogEntries,
    formatChangelogUser,
    prepareChangelogPage,
    selectChangelogFilterAttributes,
} from './normalize'

const attribute = (
    overrides: Partial<TrackedEntityAttributeField> &
        Pick<TrackedEntityAttributeField, 'id' | 'label'>
): TrackedEntityAttributeField => ({
    valueType: 'TEXT',
    rawValue: null,
    value: { kind: 'empty' },
    origin: 'both',
    displayInList: true,
    unique: false,
    ...overrides,
})

const firstName = attribute({ id: 'AttrFirst01', label: 'First name' })
const gender = attribute({
    id: 'AttrGender1',
    label: 'Gender',
    origin: 'trackedEntityType',
    options: [
        { code: 'F', displayName: 'Female' },
        { code: 'M', displayName: 'Male' },
    ],
})
const photo = attribute({
    id: 'AttrPhoto01',
    label: 'Photo',
    valueType: 'IMAGE',
    rawValue: 'FileCurrent',
    origin: 'program',
})
const consent = attribute({
    id: 'AttrConsent',
    label: 'Consent form',
    valueType: 'FILE_RESOURCE',
    rawValue: 'FileConsent',
    origin: 'program',
})

const admin = {
    uid: 'User0000001',
    username: 'admin',
    firstName: 'John',
    surname: 'Traore',
}

const row = (
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    attributeValue: ApiChangelogResponse['changeLogs'][number]['change']['attributeValue']
): ApiChangelogResponse['changeLogs'][number] => ({
    createdBy: admin,
    createdAt: '2026-10-23T15:52:02.386',
    type,
    change: { attributeValue },
})

const scope = { trackedEntityId: 'TrackedEnt1', programId: 'Program0001' }

describe('formatChangelogUser', () => {
    it('shows "First Last (username)"', () => {
        expect(formatChangelogUser(admin)).toBe('John Traore (admin)')
    })

    it('falls back to the username when no name is known', () => {
        expect(formatChangelogUser({ username: 'system' })).toBe('system')
        expect(
            formatChangelogUser({
                username: 'jane',
                firstName: ' Jane ',
                surname: '',
            })
        ).toBe('Jane (jane)')
    })
})

describe('prepareChangelogPage', () => {
    it('labels rows from the attributes and keeps unknown attributes', () => {
        const page = prepareChangelogPage(
            {
                pager: { page: 1, pageSize: 10 },
                changeLogs: [
                    row('CREATE', {
                        attribute: 'AttrFirst01',
                        currentValue: 'Ada',
                    }),
                    row('UPDATE', {
                        attribute: 'AttrUnknown',
                        previousValue: 'a',
                        currentValue: 'b',
                    }),
                ],
            },
            [firstName],
            scope
        )

        expect(page.hasNextPage).toBe(false)
        expect(page.entries).toEqual([
            {
                id: '2026-10-23T15:52:02.386-AttrFirst01-0',
                createdAt: '2026-10-23T15:52:02.386',
                user: { username: 'admin', displayName: 'John Traore (admin)' },
                attributeId: 'AttrFirst01',
                attributeLabel: 'First name',
                changeType: 'CREATE',
                previousValue: null,
                currentValue: {
                    valueType: 'TEXT',
                    rawValue: 'Ada',
                    options: undefined,
                    label: 'First name',
                },
            },
            {
                id: '2026-10-23T15:52:02.386-AttrUnknown-1',
                createdAt: '2026-10-23T15:52:02.386',
                user: { username: 'admin', displayName: 'John Traore (admin)' },
                attributeId: 'AttrUnknown',
                attributeLabel: 'AttrUnknown',
                changeType: 'UPDATE',
                previousValue: {
                    valueType: 'TEXT',
                    rawValue: 'a',
                    options: undefined,
                    label: 'AttrUnknown',
                },
                currentValue: {
                    valueType: 'TEXT',
                    rawValue: 'b',
                    options: undefined,
                    label: 'AttrUnknown',
                },
            },
        ])
    })

    it('keeps the option set so codes are labelled', () => {
        const [entry] = prepareChangelogPage(
            {
                changeLogs: [
                    row('UPDATE', {
                        attribute: 'AttrGender1',
                        previousValue: 'F',
                        currentValue: 'M',
                    }),
                ],
            },
            [gender],
            scope
        ).entries

        expect(entry?.previousValue?.options).toBe(gender.options)
        expect(entry?.currentValue?.options).toBe(gender.options)
    })

    it('links only the current file and labels replaced files as text', () => {
        const [image, file] = prepareChangelogPage(
            {
                pager: {
                    page: 1,
                    pageSize: 2,
                    nextPage: 'http://dhis2/api/x?page=2',
                },
                changeLogs: [
                    row('UPDATE', {
                        attribute: 'AttrPhoto01',
                        previousValue: 'FileOld0001',
                        currentValue: 'FileCurrent',
                    }),
                    row('DELETE', {
                        attribute: 'AttrConsent',
                        previousValue: 'FileRemoved',
                    }),
                ],
            },
            [photo, consent],
            scope
        ).entries

        expect(image?.previousValue).toEqual({
            valueType: 'TEXT',
            rawValue: 'Image',
            label: 'Photo',
        })
        expect(image?.currentValue).toEqual({
            valueType: 'IMAGE',
            rawValue: 'FileCurrent',
            label: 'Photo',
            file: {
                endpoint:
                    'tracker/trackedEntities/TrackedEnt1/attributes/AttrPhoto01',
                params: { program: 'Program0001' },
            },
        })
        expect(file?.previousValue).toEqual({
            valueType: 'TEXT',
            rawValue: 'File',
            label: 'Consent form',
        })
        expect(file?.currentValue).toBeNull()
    })

    it('reports a next page only when the pager links one', () => {
        const response = { changeLogs: [] }
        expect(prepareChangelogPage(response, [], scope).hasNextPage).toBe(
            false
        )
        expect(
            prepareChangelogPage(
                { ...response, pager: { nextPage: 'http://dhis2/next' } },
                [],
                scope
            ).hasNextPage
        ).toBe(true)
    })
})

describe('formatting a prepared page', () => {
    const page = prepareChangelogPage(
        {
            changeLogs: [
                row('UPDATE', {
                    attribute: 'AttrFirst01',
                    previousValue: 'Ada',
                    currentValue: 'Grace',
                }),
                row('DELETE', {
                    attribute: 'AttrFirst01',
                    previousValue: 'Grace',
                }),
            ],
        },
        [firstName],
        scope
    )

    it('collects every non-empty value for the formatter', () => {
        expect(
            changelogFormattableValues(page).map((value) => value.rawValue)
        ).toEqual(['Ada', 'Grace', 'Grace'])
    })

    it('formats values and dates, and empties missing values', () => {
        const formatter: ValueFormatter = {
            format: (value) => ({
                kind: 'text',
                text: `<${value.rawValue}>`,
            }),
            formatDateTime: (value) => `date:${value}`,
        }

        const entries = formatChangelogEntries(page, formatter)

        expect(entries.map((entry) => entry.createdAtLabel)).toEqual([
            'date:2026-10-23T15:52:02.386',
            'date:2026-10-23T15:52:02.386',
        ])
        expect(entries[0]?.previousValue).toEqual({
            kind: 'text',
            text: '<Ada>',
        })
        expect(entries[0]?.currentValue).toEqual({
            kind: 'text',
            text: '<Grace>',
        })
        expect(entries[1]?.currentValue).toEqual({ kind: 'empty' })
    })
})

describe('selectChangelogFilterAttributes', () => {
    const attributes = [firstName, gender, photo]

    it('lists program attributes when a program is given', () => {
        expect(
            selectChangelogFilterAttributes(attributes, 'Program0001').map(
                (item) => item.id
            )
        ).toEqual(['AttrFirst01', 'AttrPhoto01'])
    })

    it('lists tracked entity type attributes without a program', () => {
        expect(
            selectChangelogFilterAttributes(attributes, null).map(
                (item) => item.id
            )
        ).toEqual(['AttrFirst01', 'AttrGender1'])
    })
})
