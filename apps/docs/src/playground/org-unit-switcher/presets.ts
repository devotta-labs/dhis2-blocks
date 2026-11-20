import { districtOrgUnitId, type LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    assignedOrgUnits: 3,
    assignedDistricts: 0,
    orgUnitsPerDistrict: 0,
    longNames: false,
    collapsed: false,
    value: 'uncontrolled',
    texts: 'default',
    rtl: false,
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
    /** What the lab user's storage holds before the block first reads it, as stored. */
    seed?: string
    /** Kept under the shared Edge cases fold, closed to start, so the first look stays short. */
    folded?: boolean
}

const DISTRICT_NURSE: Partial<LabSettings> = {
    assignedOrgUnits: 0,
    assignedDistricts: 1,
    orgUnitsPerDistrict: 40,
}
const NURSE_PICKS = JSON.stringify({
    current: districtOrgUnitId(1, 5),
    recent: [districtOrgUnitId(1, 5), districtOrgUnitId(1, 12)],
})

const preset = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {},
    extra: Pick<Preset, 'description' | 'seed'> = {}
) => ({
    group,
    name,
    settings: { ...DEFAULT_SETTINGS, ...changes },
    ...extra,
})

const edge = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {},
    extra: Pick<Preset, 'description' | 'seed'> = {}
) => ({
    ...preset(group, name, changes, extra),
    folded: true,
})

const UNTICK = 'Untick the failure, then press Retry.'

const ME_FAILS: Partial<LabSettings> = {
    network: { delay: 50, endpoints: { me: { behaviour: 'fails' } } },
}

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
        { assignedOrgUnits: 1 },
        {
            description: 'A plain label: nothing to choose.',
        }
    ),
    DEFAULT_PRESET,
    preset(
        'Everyday',
        'Two clinics, collapsed sidebar',
        {
            assignedOrgUnits: 2,
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
        seed: NURSE_PICKS,
    }),
    preset(
        'Everyday',
        'Called clinics',
        { texts: 'clinics' },
        {
            description:
                'The app passes texts for clinics: the trigger, the menu, the messages and the announcement all say clinic.',
        }
    ),
    preset(
        'Everyday',
        'Called schools',
        { ...DISTRICT_NURSE, texts: 'schools' },
        {
            description:
                "The same block with an app's texts for schools. Open the menu for All schools, or type to search them.",
        }
    ),
    preset(
        'More clinics',
        'Nine clinics, no search request',
        {
            assignedOrgUnits: 9,
        },
        {
            description:
                "Open the menu and type 'chc': it filters the nine here, with no request on the waterfall.",
        }
    ),
    preset(
        'More clinics',
        'About 5,000 clinics',
        {
            assignedOrgUnits: 0,
            assignedDistricts: 3,
            orgUnitsPerDistrict: 1667,
        },
        {
            description:
                'Open the menu without typing: All clinics lists the first 20 by name, and Show more at the end of the list pages through the rest. Each page is one request in the logs.',
        }
    ),
    edge('Assignment', 'No clinic assigned', { assignedOrgUnits: 0 }),
    edge(
        'Controlled host',
        'Controlled host that follows picks',
        { value: 'follows' },
        {
            description:
                'The host holds the value and adopts each onValueChange: pick a clinic and the page, the announcement and Remembered follow.',
        }
    ),
    edge(
        'Controlled host',
        'Controlled host that ignores picks',
        { value: 'valid' },
        {
            description:
                'The host holds one clinic and ignores onValueChange: a pick is logged, but the selector, the page and Remembered stay, and nothing is announced.',
        }
    ),
    edge(
        'Languages',
        'Right to left',
        { ...DISTRICT_NURSE, rtl: true },
        {
            description:
                "The sidebar mirrors, the tile at the inline start and the chevron at the end. The menus open on the page's body, which stays left to right here; in an app that sets dir on its document they mirror too, the check at the inline end.",
        }
    ),
    edge(
        'Names',
        'Very long names',
        { longNames: true },
        {
            description:
                'The trigger shows the short name, with the full one on hover or focus. The menu wraps each 120-character name over two lines.',
        }
    ),
    edge('Server', 'Clinics fail to load', ME_FAILS, {
        description:
            'The user request fails, and so do its two retries: after about three seconds, the error with Retry. Set Network back to Normal, then press Retry.',
    }),
    edge(
        'Server',
        'Search fails',
        { ...DISTRICT_NURSE, failSearch: true },
        {
            description: `Open the menu and type 'chc': after two retries, about three seconds, the search fails with Retry in the menu. ${UNTICK}`,
        }
    ),
    edge(
        'Server',
        'Validity check fails',
        { ...DISTRICT_NURSE, failValidity: true },
        {
            description:
                'Storage remembers two clinics in the district, and checking them fails, retries included: after about three seconds the selector reads Choose a clinic and still lists the district, and nothing remembered is lost. Untick the failure and press Retry on the page to check again.',
            seed: NURSE_PICKS,
        }
    ),
]
