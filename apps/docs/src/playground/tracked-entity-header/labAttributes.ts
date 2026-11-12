/** The lab's attributes: what DHIS2 would say about each one. */
export const FIRST_NAME = 'labFirstNam'
export const LAST_NAME = 'labLastName'
export const BIRTH_DATE = 'labBirthDat'
export const UNIQUE_ID = 'labUniqueId'
export const GENDER = 'labGender01'
export const MOBILE = 'labMobile01'
export const ALLERGIES = 'labAllergie'
// Same labels, but their option sets have no names, so the block can't read them.
export const BROKEN_LAST = 'labLastBrkn'
export const BROKEN_ALLERGIES = 'labAllerBrk'
// A person with much more on record.
export const NATIONAL_ID = 'labNatnlId1'
export const ADDRESS = 'labAddress1'
export const VILLAGE = 'labVillage1'
export const DISTRICT = 'labDistrct1'
export const OCCUPATION = 'labOccupat1'
export const EDUCATION = 'labEducatn1'
export const CIVIL_STATUS = 'labCivilSt1'
export const NEXT_OF_KIN = 'labNextKin1'
export const KIN_PHONE = 'labKinPhon1'
export const BLOOD_GROUP = 'labBloodGr1'
export const LANGUAGE = 'labLanguag1'
export const EMAIL = 'labEmail001'
export const INSURANCE = 'labInsuranc'
// Form names this long are common in DHIS2.
export const NET_USE = 'labNetUse01'
// A vaccine shipment: the same banner for something that isn't a person.
export const SHIPMENT_NUMBER = 'labShipNum1'
export const VACCINE = 'labVaccine1'
export const DOSES = 'labDoses001'
export const BATCH = 'labBatchNo1'
export const EXPIRY = 'labExpiry01'
export const VVM = 'labVvmStage'
export const DESTINATION = 'labDestintn'
export const CARRIER = 'labCarrier1'

interface AttributeSpec {
    label: string
    valueType: string
    options?: Array<[code: string, displayName: string]>
    displayInList: boolean
    /** Options without names: metadata the block can't read. */
    broken?: boolean
}

const ATTRIBUTES = new Map<string, AttributeSpec>(
    Object.entries({
        [UNIQUE_ID]: {
            label: 'Unique ID',
            valueType: 'TEXT',
            displayInList: true,
        },
        [FIRST_NAME]: {
            label: 'First name',
            valueType: 'TEXT',
            displayInList: true,
        },
        [LAST_NAME]: {
            label: 'Last name',
            valueType: 'TEXT',
            displayInList: true,
        },
        [GENDER]: {
            label: 'Sex',
            valueType: 'TEXT',
            options: [
                ['F', 'Female'],
                ['M', 'Male'],
            ],
            displayInList: true,
        },
        [MOBILE]: {
            label: 'Mobile number',
            valueType: 'PHONE_NUMBER',
            displayInList: true,
        },
        [BIRTH_DATE]: {
            label: 'Birth date',
            valueType: 'DATE',
            displayInList: false,
        },
        [ALLERGIES]: {
            label: 'Allergies',
            valueType: 'MULTI_TEXT',
            options: [
                ['Penicillin', 'Penicillin and related antibiotics'],
                ['SULFA', 'Antibiotics containing sulfonamides (sulfa drugs)'],
                ['NSAIDS', 'Aspirin, ibuprofen and other NSAIDs'],
            ],
            displayInList: true,
        },
        [BROKEN_LAST]: {
            label: 'Last name',
            valueType: 'TEXT',
            options: [['Sesay', 'Sesay']],
            displayInList: true,
            broken: true,
        },
        [BROKEN_ALLERGIES]: {
            label: 'Allergies',
            valueType: 'MULTI_TEXT',
            options: [['Penicillin', 'Penicillin and related antibiotics']],
            displayInList: true,
            broken: true,
        },
        [NATIONAL_ID]: {
            label: 'National ID',
            valueType: 'TEXT',
            displayInList: false,
        },
        [ADDRESS]: {
            label: 'Home address',
            valueType: 'LONG_TEXT',
            displayInList: false,
        },
        [VILLAGE]: {
            label: 'Village',
            valueType: 'TEXT',
            displayInList: false,
        },
        [DISTRICT]: {
            label: 'District',
            valueType: 'TEXT',
            displayInList: false,
        },
        [OCCUPATION]: {
            label: 'Occupation',
            valueType: 'TEXT',
            displayInList: false,
        },
        [EDUCATION]: {
            label: 'Highest education level',
            valueType: 'TEXT',
            options: [
                ['NONE', 'None'],
                ['PRIMARY', 'Primary'],
                ['SECONDARY', 'Secondary'],
                ['TERTIARY', 'Tertiary'],
            ],
            displayInList: false,
        },
        [CIVIL_STATUS]: {
            label: 'Civil status',
            valueType: 'TEXT',
            options: [
                ['MARRIED', 'Married'],
                ['SINGLE', 'Single'],
                ['WIDOWED', 'Widowed'],
            ],
            displayInList: false,
        },
        [NEXT_OF_KIN]: {
            label: 'Next of kin',
            valueType: 'TEXT',
            displayInList: false,
        },
        [KIN_PHONE]: {
            label: 'Next of kin phone',
            valueType: 'PHONE_NUMBER',
            displayInList: false,
        },
        [BLOOD_GROUP]: {
            label: 'Blood group',
            valueType: 'TEXT',
            options: [
                ['A+', 'A positive'],
                ['O+', 'O positive'],
                ['B-', 'B negative'],
            ],
            displayInList: false,
        },
        [LANGUAGE]: {
            label: 'Preferred language',
            valueType: 'TEXT',
            displayInList: false,
        },
        [EMAIL]: {
            label: 'Email address',
            valueType: 'EMAIL',
            displayInList: false,
        },
        [INSURANCE]: {
            label: 'Health insurance number',
            valueType: 'TEXT',
            displayInList: false,
        },
        [NET_USE]: {
            label: 'Number of household members who slept under an insecticide-treated net last night',
            valueType: 'INTEGER_ZERO_OR_POSITIVE',
            displayInList: false,
        },
        [SHIPMENT_NUMBER]: {
            label: 'Shipment number',
            valueType: 'TEXT',
            displayInList: true,
        },
        [VACCINE]: {
            label: 'Vaccine',
            valueType: 'TEXT',
            options: [
                ['BCG', 'BCG'],
                ['MR', 'Measles-rubella'],
                ['PENTA', 'Pentavalent (DTP-HepB-Hib)'],
            ],
            displayInList: true,
        },
        [DOSES]: {
            label: 'Doses',
            valueType: 'INTEGER_POSITIVE',
            displayInList: true,
        },
        [BATCH]: {
            label: 'Batch number',
            valueType: 'TEXT',
            displayInList: true,
        },
        [EXPIRY]: {
            label: 'Expiry date',
            valueType: 'DATE',
            displayInList: true,
        },
        [VVM]: {
            label: 'Vaccine vial monitor',
            valueType: 'TEXT',
            options: [
                ['1', 'Stage 1, usable'],
                ['2', 'Stage 2, usable'],
                ['3', 'Stage 3, discard'],
            ],
            displayInList: true,
        },
        [DESTINATION]: {
            label: 'Destination',
            valueType: 'TEXT',
            displayInList: false,
        },
        [CARRIER]: {
            label: 'Carrier',
            valueType: 'TEXT',
            displayInList: false,
        },
    })
)

export const specOf = (id: string): AttributeSpec => {
    const spec = ATTRIBUTES.get(id)
    if (!spec) throw new Error(`The lab has no attribute ${id}`)
    return spec
}
