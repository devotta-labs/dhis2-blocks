import type { LabNetwork } from '../network'
import type { LabConfig, LabData, LabServer, LabView } from './labData'

export const DEFAULT_CONFIG: LabConfig = {
    data: { rows: 230, seed: 0 },
    server: { apiVersion: 42, query: 'honoured', response: 'valid' },
    network: { delay: 50, endpoints: {} },
    view: {
        pageSize: 15,
        filters: true,
        columnSettings: true,
        density: false,
        selection: false,
        pagination: true,
        clickable: true,
    },
}

export interface Preset {
    group: string
    name: string
    config: LabConfig
}

const preset = (
    group: string,
    name: string,
    changes: {
        data?: Partial<LabData>
        server?: Partial<LabServer>
        network?: Partial<LabNetwork>
        view?: Partial<LabView>
    } = {}
): Preset => ({
    group,
    name,
    config: {
        data: { ...DEFAULT_CONFIG.data, ...changes.data },
        server: { ...DEFAULT_CONFIG.server, ...changes.server },
        network: { ...DEFAULT_CONFIG.network, ...changes.network },
        view: { ...DEFAULT_CONFIG.view, ...changes.view },
    },
})

export const PRESETS: readonly Preset[] = [
    preset('Lists', 'Default'),
    preset('Lists', 'Large page', {
        data: { rows: 500 },
        view: { pageSize: 50 },
    }),
    preset('Lists', 'Bulk selection', {
        view: { selection: true, density: true },
    }),
    preset('Lists', 'Bare table', {
        view: { filters: false, columnSettings: false, density: false },
    }),
    preset('Server', 'Empty list', { data: { rows: 0 } }),
    // The network controls' Slow.
    preset('Server', 'Slow server', { network: { delay: 2000 } }),
    preset('Server', 'Server error', {
        network: {
            endpoints: { 'tracker/trackedEntities': { behaviour: 'fails' } },
        },
    }),
    preset('Server', 'Malformed response', {
        server: { response: 'malformed' },
    }),
]
