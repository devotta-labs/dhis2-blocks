export type RepairLocation =
    | {
          kind: 'filter'
          collection: 'filters' | 'attributeValueFilters' | 'dataFilters'
          index: number
          scope?: boolean
      }
    | {
          kind: 'column'
          collection: 'columns' | 'displayColumnOrder'
          index: number
      }
    | { kind: 'sort'; source: 'configuration' | 'resource' }

export const formatRepairLocation = (location: RepairLocation): string => {
    if (location.kind === 'sort') {
        return location.source === 'configuration' ? 'sort.fieldId' : 'order'
    }
    const prefix = `${location.collection}.${location.index}`
    if (location.kind === 'column') return prefix
    switch (location.collection) {
        case 'filters':
            return `${prefix}.field${location.scope ? '.scope' : ''}`
        case 'attributeValueFilters':
            return `${prefix}.attribute`
        case 'dataFilters':
            return `${prefix}.dataItem`
    }
}

export const parseRepairLocation = (
    path: string
): RepairLocation | undefined => {
    if (path === 'sort.fieldId' || path === 'order') {
        return {
            kind: 'sort',
            source: path === 'order' ? 'resource' : 'configuration',
        }
    }
    const filter =
        /^(filters|attributeValueFilters|dataFilters)\.(\d+)\.(field(?:\.scope)?|attribute|dataItem)$/.exec(
            path
        )
    if (filter) {
        const collection = filter[1]
        if (
            collection !== 'filters' &&
            collection !== 'attributeValueFilters' &&
            collection !== 'dataFilters'
        )
            return undefined
        const location: RepairLocation = {
            kind: 'filter',
            collection,
            index: Number(filter[2]),
            scope: filter[3] === 'field.scope',
        }
        return formatRepairLocation(location) === path ? location : undefined
    }
    const column = /^(columns|displayColumnOrder)\.(\d+)$/.exec(path)
    if (
        column &&
        (column[1] === 'columns' || column[1] === 'displayColumnOrder')
    ) {
        return {
            kind: 'column',
            collection: column[1],
            index: Number(column[2]),
        }
    }
    return undefined
}
