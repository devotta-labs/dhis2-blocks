import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListField } from '../../domain/model'
import {
    fieldDisplayName,
    localizedField,
    usesMultipleOptionSelection,
} from '../FilterControls'

const capabilities = resolveWorkingListCapabilities({ apiVersion: 43 })

const optionField = (source: WorkingListField['source']): WorkingListField => ({
    id: source === 'system' ? 'eventStatus' : 'gender',
    displayName: source === 'system' ? 'Event status' : 'Gender',
    source,
    scope: source === 'system' ? 'event' : 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
    options: [
        { code: 'ACTIVE', displayName: 'Active' },
        { code: 'COMPLETED', displayName: 'Completed' },
    ],
})

describe('filter control policy', () => {
    it('keeps Capture system status filters single-select', () => {
        expect(
            usesMultipleOptionSelection(optionField('system'), capabilities)
        ).toBe(false)
    })

    it('allows metadata option sets to use supported multi-selection', () => {
        expect(
            usesMultipleOptionSelection(
                optionField('trackedEntityAttribute'),
                capabilities
            )
        ).toBe(true)
    })

    it('localizes generated system labels but preserves metadata display names', () => {
        const translate = (message: string) => `translated:${message}`
        const system = localizedField(optionField('system'), translate)
        const metadata = localizedField(
            optionField('trackedEntityAttribute'),
            translate
        )
        const metadataSystem = localizedField(
            {
                ...optionField('system'),
                displayName: 'TB visit date',
                displayNameIsMetadata: true,
            },
            translate
        )

        expect(fieldDisplayName(system, translate)).toBe(
            'translated:Event status'
        )
        expect(system.options?.[0]?.displayName).toBe('translated:Active')
        expect(metadata.displayName).toBe('Gender')
        expect(metadata.options?.[0]?.displayName).toBe('Active')
        expect(metadataSystem.displayName).toBe('TB visit date')
    })
})
