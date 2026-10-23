import type { AttributeMetadata, ProgramMetadata } from '../../api/schemas'

const attribute = (
    id: string,
    label: string,
    valueType: string,
    overrides: Partial<AttributeMetadata> = {}
): AttributeMetadata => ({
    id,
    label,
    valueType,
    unique: false,
    searchable: false,
    displayInList: false,
    blockedSearchOperators: [],
    minCharactersToSearch: 0,
    ...overrides,
})

export const hivProgram: ProgramMetadata = {
    program: 'hivProgram',
    name: 'HIV Program',
    trackedEntityType: 'personType',
    minAttributesRequiredToSearch: 2,
    maxTeiCountToReturn: 5,
    attributes: [
        attribute('artNumber', 'ART number', 'TEXT', {
            unique: true,
            searchable: true,
            displayInList: true,
        }),
        attribute('legacyId', 'Legacy ID', 'TEXT', { unique: true }),
        attribute('firstName', 'First name', 'TEXT', {
            searchable: true,
            displayInList: true,
            minCharactersToSearch: 2,
        }),
        attribute('lastName', 'Last name', 'TEXT', { displayInList: true }),
        attribute('dob', 'Date of birth', 'DATE', {
            searchable: true,
            displayInList: true,
        }),
        attribute('sex', 'Sex', 'TEXT', {
            searchable: true,
            displayInList: true,
            options: [
                { code: 'F', name: 'Female' },
                { code: 'M', name: 'Male' },
            ],
        }),
        attribute('weight', 'Weight', 'INTEGER', { searchable: true }),
        attribute('visit', 'Last visit', 'DATETIME', { searchable: true }),
        attribute('photo', 'Photo', 'IMAGE', { searchable: true }),
        attribute('nickname', 'Nickname', 'TEXT', {
            searchable: true,
            blockedSearchOperators: ['like', 'sw', 'eq'],
        }),
    ],
}
