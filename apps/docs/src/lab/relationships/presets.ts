import type { RelationshipViewerLayout } from '@/components/relationship-viewer'
import type { LabData } from './labData'
import type { LabServer } from './labServer'

/** The block's own props and composition, as the lab sets them. */
export interface LabView {
    start: 'index' | 'cases' | 'query'
    hops: number
    cap: number
    follow: { contact: boolean; household: boolean; labResult: boolean }
    attentionRule: 'followUp' | 'overdue' | 'none'
    overdueDays: number
    dateRule: 'enrolled' | 'onset' | 'none'
    label: 'dataView' | 'village' | 'uid'
    layout: RelationshipViewerLayout
    parts: {
        toggle: boolean
        summary: boolean
        notices: boolean
        legend: boolean
        list: boolean
    }
    height: number // px of the canvas
}

export interface LabConfig {
    data: LabData
    server: LabServer
    view: LabView
}

const DATA: LabData = {
    spread: 'mixed',
    people: 60,
    attention: 15,
    overdue: 20,
    completed: 10,
    undated: 0,
    outOfProgram: 0,
    failing: 0,
    sameDay: false,
    longNames: false,
    events: false,
    seed: 7,
}

const VIEW: LabView = {
    start: 'cases',
    hops: 2,
    cap: 500,
    follow: { contact: true, household: true, labResult: true },
    attentionRule: 'followUp',
    overdueDays: 3,
    dateRule: 'enrolled',
    label: 'dataView',
    layout: 'web',
    parts: {
        toggle: true,
        summary: true,
        notices: true,
        legend: true,
        list: true,
    },
    height: 640,
}

export const DEFAULT_CONFIG: LabConfig = {
    data: DATA,
    server: { latency: 120, metadata: 'ok' },
    view: VIEW,
}

interface Preset {
    group: string
    name: string
    config: LabConfig
}

const preset = (
    group: string,
    name: string,
    data: Partial<LabData> = {},
    view: Partial<LabView> = {},
    server: Partial<LabServer> = {}
): Preset => ({
    group,
    name,
    config: {
        data: { ...DATA, ...data },
        server: { ...DEFAULT_CONFIG.server, ...server },
        view: { ...VIEW, ...view },
    },
})

export const PRESETS: Preset[] = [
    preset('Outbreak shapes', 'Mixed outbreak, 60 people'),
    preset(
        'Outbreak shapes',
        'Ebola chains: one infects one',
        { spread: 'chains', people: 40 },
        { start: 'index', hops: 6, layout: 'trace' }
    ),
    preset(
        'Outbreak shapes',
        'Measles superspreaders',
        { spread: 'hubs', people: 120, seed: 3 },
        { hops: 4 }
    ),
    preset(
        'Outbreak shapes',
        'Cholera households',
        { spread: 'households', people: 70 },
        { hops: 4 }
    ),
    preset(
        'Outbreak shapes',
        'District outbreak, 400 people',
        { spread: 'mixed', people: 400, seed: 11 },
        { start: 'query', hops: 2 },
        { latency: 40 }
    ),
    preset(
        'Outbreak shapes',
        'Past the cap: 1,000 people, cap 300',
        { spread: 'mixed', people: 1000, seed: 5 },
        { start: 'query', hops: 2, cap: 300 },
        { latency: 20 }
    ),
    preset(
        'One case',
        'Index case and first contacts',
        { spread: 'hubs', people: 30, seed: 2 },
        { start: 'index', hops: 1, layout: 'trace' }
    ),
    preset(
        'One case',
        'A lone case',
        { people: 1 },
        { start: 'index', hops: 1, layout: 'trace' }
    ),
    preset(
        'One case',
        'Lab results linked to cases',
        { spread: 'chains', people: 20, events: true },
        { start: 'index', hops: 4, layout: 'trace' }
    ),
    preset(
        'Follow-up',
        'Many contacts overdue',
        { spread: 'hubs', people: 80, overdue: 60, seed: 3 },
        { attentionRule: 'overdue', hops: 3 }
    ),
    preset(
        'Follow-up',
        'A household that all needs attention',
        { spread: 'households', people: 8, attention: 100 },
        { start: 'index', hops: 1, layout: 'trace' }
    ),
    preset(
        'Follow-up',
        'Follow-up mostly completed',
        { people: 60, completed: 80, attention: 5 },
        { hops: 3 }
    ),
    preset(
        'Messy data',
        'Missing enrollment dates',
        { spread: 'chains', people: 30, undated: 30 },
        { start: 'index', hops: 6, layout: 'trace' }
    ),
    preset(
        'Messy data',
        'Same-day contacts',
        { spread: 'hubs', people: 40, sameDay: true, seed: 3 },
        { start: 'index', hops: 2, layout: 'trace' }
    ),
    preset(
        'Messy data',
        'Long names',
        { people: 40, longNames: true },
        { start: 'index', hops: 3, layout: 'trace' }
    ),
    preset(
        'Messy data',
        'Records that fail to load',
        { people: 50, failing: 12 },
        { hops: 3 }
    ),
    preset(
        'Messy data',
        'Contacts outside the program',
        { people: 50, outOfProgram: 25 },
        { hops: 3 }
    ),
    preset(
        'Messy data',
        'Household links not followed',
        { spread: 'households', people: 50 },
        {
            hops: 4,
            follow: { contact: true, household: false, labResult: true },
        }
    ),
    preset(
        'Server',
        'Slow server (1.5 s per request)',
        { people: 40 },
        { hops: 3 },
        { latency: 1500 }
    ),
    preset(
        'Server',
        'Metadata request fails',
        { people: 40 },
        { hops: 3 },
        { metadata: 'fails' }
    ),
]

/** Starting points on the repository's seeded e2e instance. */
export const LIVE_PRESETS = [
    {
        name: 'Seeded hub case',
        te: 'RvE2eTei010',
        program: 'RvE2ePrg001',
        orgUnit: '',
    },
    {
        name: 'Seeded outbreak (query)',
        te: '',
        program: 'RvE2ePrg001',
        orgUnit: 'DiszpKrYNg8',
    },
]
