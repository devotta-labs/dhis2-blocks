import i18n from '../../i18n'

export interface ObservationPreset {
    id: 'rmnch' | 'seeded'
    /** A function so the label follows the current language. */
    label: () => string
    programId: string
    trend: string[]
    latest: string[]
    units: Record<string, string>
    staleAfterDays?: number
    /** A person to offer as a one-click suggestion while no `te` is set. */
    suggestedTrackedEntityId?: string
}

// The extractor reads a colon as a namespace separator (d2-i18n turns
// namespaces off at runtime); a separator absent from the key keeps it whole.
export const OBSERVATION_PRESETS: [ObservationPreset, ObservationPreset] = [
    {
        id: 'rmnch',
        label: () =>
            i18n.t('Real data: WHO RMNCH Tracker', {
                nsSeparator: '::',
            }),
        programId: 'WSGAb5XwJ3Y',
        trend: ['vANAXwtLwcT'],
        latest: ['sWoqcoByYmD', 'EyfTU3ibMmJ'],
        units: { vANAXwtLwcT: 'g/dL' },
    },
    {
        id: 'seeded',
        label: () =>
            i18n.t('Full features: seeded program', {
                nsSeparator: '::',
            }),
        programId: 'ObE2ePrg001',
        trend: ['ObE2eDel001', 'ObE2eDel002', 'ObE2eDel003', 'ObE2eDel004'],
        latest: ['ObE2eDel005', 'ObE2eDel006'],
        units: {
            ObE2eDel001: 'mmHg',
            ObE2eDel002: 'mmHg',
            ObE2eDel003: 'kg',
            ObE2eDel004: 'g/dL',
        },
        staleAfterDays: 180,
        suggestedTrackedEntityId: 'ObE2eTei001',
    },
]
