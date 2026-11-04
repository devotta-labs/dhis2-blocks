import type { LabNetwork } from '../../network'
import type { LabConfig, LabData, LabServer, LabView } from './labData'

export const DEFAULT_CONFIG: LabConfig = {
    data: {
        mode: 'trackedEntity',
        records: 230,
        names: 'everyday',
        emptyValues: 10,
        badValues: 0,
    },
    server: {
        apiVersion: 42,
        query: 'honoured',
        savedViews: 'some',
        viewAccess: 'owner',
    },
    network: { delay: 250, endpoints: {} },
    view: {
        viewSwitcher: true,
        toolbar: true,
        columnSelector: true,
        filterControls: true,
        actions: true,
        dataQuality: 'hidden',
        clickable: true,
        pageSize: 15,
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
    preset('Lists', 'Clinic enrollments'),
    preset('Lists', 'Follow-up visits', { data: { mode: 'event' } }),
    preset('Lists', 'Many saved views', {
        server: { savedViews: 'many' },
    }),
    preset('Data', 'Long names', { data: { names: 'long' } }),
    preset('Data', 'Unicode and RTL', { data: { names: 'unicode' } }),
    preset('Data', 'Values that do not parse', {
        data: { badValues: 35 },
        view: { dataQuality: 'highlighted' },
    }),
    preset('Data', 'No records', { data: { records: 0 } }),
    preset('Data', 'Five thousand records', { data: { records: 5000 } }),
]
