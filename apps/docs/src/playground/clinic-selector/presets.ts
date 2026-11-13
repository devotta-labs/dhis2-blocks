import {
    districtClinicId,
    flatClinicId,
    GONE,
    OUTSIDE,
    type LabSettings,
    type LabUser,
} from './labData'

/** What a preset writes to `localStorage` before the block first reads it, per lab user, as stored. */
export type Seed = Partial<Record<LabUser, string>>

export const DEFAULT_SETTINGS: LabSettings = {
    assignedClinics: 3,
    assignedDistricts: 0,
    clinicsPerDistrict: 0,
    longNames: false,
    sameInitials: false,
    userId: 'u1',
    collapsed: false,
    value: 'uncontrolled',
    label: 'Clinic',
    storageThrows: false,
    ignoreScopeFilter: false,
    failSearch: false,
    failValidity: false,
    network: { delay: 50, endpoints: {} },
}

export interface Preset {
    group: string
    name: string
    /** What it shows, and what to do when it only shows after a click. */
    description?: string
    settings: LabSettings
    seed?: Seed
    /** Kept under the shared Edge cases fold, closed to start, so the first look stays short. */
    folded?: boolean
}

const remembered = (current: string | undefined, recent: string[]) =>
    JSON.stringify({ current, recent })

/** A remembered clinic the server no longer has. */
export const GONE_VALUE = remembered(GONE, [GONE])
/** A value cut off mid-write. */
export const CORRUPT_VALUE = '{"current":"labFlat0002","recent":['

const DISTRICT_NURSE: Partial<LabSettings> = {
    assignedClinics: 0,
    assignedDistricts: 1,
    clinicsPerDistrict: 40,
}
const NURSE_PICKS = remembered(districtClinicId(1, 5), [
    districtClinicId(1, 5),
    districtClinicId(1, 12),
])

const preset = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {},
    extra: Pick<Preset, 'description' | 'seed'> = {}
): Preset => ({
    group,
    name,
    settings: { ...DEFAULT_SETTINGS, ...changes },
    ...extra,
})

/** An edge case: `PresetControls` already folds these under Edge cases, so `group` names the kind. */
const edge = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {},
    extra: Pick<Preset, 'description' | 'seed'> = {}
): Preset => ({
    ...preset(group, name, changes, extra),
    folded: true,
})

const failing = (behaviour: 'fails' | 'hangs'): Partial<LabSettings> => ({
    network: { delay: 50, endpoints: { me: { behaviour } } },
})

/** The preset the lab opens on without a linked one. */
export const DEFAULT_PRESET = preset(
    'Everyday',
    'Three clinics',
    {},
    {
        description: 'A menu of three, the current one checked.',
    }
)

export const PRESETS: readonly Preset[] = [
    preset(
        'Everyday',
        'One clinic',
        { assignedClinics: 1 },
        {
            description: 'A plain label: nothing to choose.',
        }
    ),
    DEFAULT_PRESET,
    preset(
        'Everyday',
        'Two clinics, collapsed sidebar',
        {
            assignedClinics: 2,
            collapsed: true,
        },
        {
            description:
                'Only the tile; hover it for the name. Narrow the page below the md breakpoint and the name returns.',
        }
    ),
    preset('Everyday', 'District nurse', DISTRICT_NURSE, {
        description:
            'Assigned a district of 40 clinics, with two picked before: open the menu for Recent, then type to search the district.',
        seed: { u1: NURSE_PICKS },
    }),
    preset(
        'Everyday',
        'Facility, not Clinic',
        { label: 'Facility' },
        {
            description: "The trigger's accessible name says Facility.",
        }
    ),
    preset(
        'More clinics',
        'Nine clinics, no search request',
        {
            assignedClinics: 9,
        },
        {
            description:
                "Open the menu and type 'chc': it filters the nine here, with no request on the waterfall.",
        }
    ),
    preset(
        'More clinics',
        'District and one of its own clinics',
        {
            assignedClinics: 1,
            assignedDistricts: 1,
            clinicsPerDistrict: 12,
        },
        {
            description:
                "The clinic sits inside the district. Open the menu and type 'mchp' to search the district.",
        }
    ),
    preset(
        'More clinics',
        'Three districts × 200',
        {
            assignedClinics: 0,
            assignedDistricts: 3,
            clinicsPerDistrict: 200,
        },
        {
            description:
                "Open the menu and type 'mchp': 150 match, so it shows 50 and asks you to keep typing.",
        }
    ),
    edge('Assignment', 'No clinic assigned', { assignedClinics: 0 }),
    edge(
        'Remembered',
        'Remembered clinic no longer exists',
        {},
        {
            description:
                'Storage remembers a clinic the server no longer has: it is checked, dropped from storage, and the first clinic shows.',
            seed: { u1: GONE_VALUE },
        }
    ),
    edge(
        'Remembered',
        'Corrupt remembered value',
        {},
        {
            description:
                'Storage holds a value cut off mid-write: it is ignored, and the first clinic shows until you pick one.',
            seed: { u1: CORRUPT_VALUE },
        }
    ),
    edge(
        'Remembered',
        'Storage throws',
        { storageThrows: true },
        {
            description:
                "Storage remembers the second clinic, but every call for the block's key throws: the first shows, and picks work until a reload. Untick Storage throws to see the second.",
            seed: { u1: remembered(flatClinicId(2), []) },
        }
    ),
    edge(
        'Remembered',
        'Second user on this computer',
        { ...DISTRICT_NURSE, userId: 'u2' },
        {
            description:
                "The first user's picks are in storage, but this is the second user: no Recent. Switch User to u1 to see them.",
            seed: { u1: NURSE_PICKS },
        }
    ),
    edge(
        'Scope',
        'Controlled, value outside scope',
        { value: 'outside' },
        {
            description:
                "The host passes a clinic outside the user's units: it is checked, not found, and the selector asks to choose.",
        }
    ),
    edge(
        'Scope',
        'Server ignores the scope filter',
        { ignoreScopeFilter: true },
        {
            description:
                "Storage remembers a clinic outside the user's units and the server returns it anyway: the block's own path check drops it.",
            seed: { u1: remembered(OUTSIDE, [OUTSIDE]) },
        }
    ),
    edge(
        'Names',
        'Very long names',
        { longNames: true },
        {
            description: '120-character names, in the trigger and the menu.',
        }
    ),
    edge(
        'Names',
        'Every name starts with B',
        {
            assignedClinics: 9,
            sameInitials: true,
        },
        {
            description:
                'The tiles share an initial, so only their colour tells them apart.',
        }
    ),
    edge('Server', 'Clinics fail to load', failing('fails'), {
        description:
            'The user request fails, and so do its two retries: after about three seconds, the error with Retry.',
    }),
    edge('Server', 'Clinics never load', failing('hangs'), {
        description: 'The user request never answers: loading, for good.',
    }),
    edge(
        'Server',
        'Search fails',
        { ...DISTRICT_NURSE, failSearch: true },
        {
            description:
                "Open the menu and type 'chc': after two retries, about three seconds, the search fails with Retry in the menu.",
        }
    ),
    edge(
        'Server',
        'Validity check fails',
        { ...DISTRICT_NURSE, failValidity: true },
        {
            description:
                'Storage remembers two clinics in the district, and checking them fails, retries included: after about three seconds, the error with Retry.',
            seed: { u1: NURSE_PICKS },
        }
    ),
]
