import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { OrganisationUnitTree } from '@dhis2/ui'
import type { ComponentType, MouseEvent } from 'react'
import React, { useCallback, useMemo, useState } from 'react'
import i18n from '../../i18n'
import type { OrganisationUnitReference } from '../organisationUnitScope'
import {
    buildOrganisationUnitTreeFilter,
    getInitialOrganisationUnitExpandedPaths,
} from './treeFilter'
import styles from './OrganisationUnitSelectorContent.module.css'

interface OrganisationUnitSelectorContentProps {
    roots: OrganisationUnitReference[]
    allowedPaths: string[]
    selected?: OrganisationUnitReference
    searchValue: string
    onSearchChange: (value: string) => void
    searchRoots?: OrganisationUnitReference[]
    searchLoading?: boolean
    searchError?: boolean
    onSearchRetry?: () => void
    searchHasMore?: boolean
    searchLoadingMore?: boolean
    searchLoadMoreError?: boolean
    onSearchLoadMore?: () => void
    treeKey: string
    onSelect: (organisationUnit: OrganisationUnitReference) => void
    treeComponent?: ComponentType<OrganisationUnitTreeRuntimeProps>
}

interface OrganisationUnitTreeRuntimeProps {
    roots: string[]
    filter: string[]
    selected: string[]
    singleSelection: boolean
    expanded: string[]
    handleExpand: (payload: { path: string }) => void
    handleCollapse: (payload: { path: string }) => void
    onChange: (
        payload: OrganisationUnitReference & { checked: boolean },
        event: MouseEvent<HTMLElement>
    ) => void
}

const Dhis2OrganisationUnitTree = (props: OrganisationUnitTreeRuntimeProps) => {
    // SAFETY: The runtime accepts controlled string paths while the published type incorrectly declares a boolean.
    const expanded = props.expanded as never
    return <OrganisationUnitTree {...props} expanded={expanded} />
}

interface ControlledOrganisationUnitTreeProps {
    visibleRoots: OrganisationUnitReference[]
    allowedPaths: string[]
    selected?: OrganisationUnitReference
    onSelect: (organisationUnit: OrganisationUnitReference) => void
    TreeComponent: ComponentType<OrganisationUnitTreeRuntimeProps>
}

const ControlledOrganisationUnitTree = ({
    visibleRoots,
    allowedPaths,
    selected,
    onSelect,
    TreeComponent,
}: ControlledOrganisationUnitTreeProps) => {
    const treeFilter = useMemo(
        () => buildOrganisationUnitTreeFilter(allowedPaths, visibleRoots),
        [allowedPaths, visibleRoots]
    )
    const [expanded, setExpanded] = useState(() =>
        getInitialOrganisationUnitExpandedPaths(visibleRoots, selected?.path)
    )
    const handleExpand = useCallback(({ path }: { path: string }) => {
        setExpanded((current) =>
            current.includes(path) ? current : [...current, path]
        )
    }, [])
    const handleCollapse = useCallback(({ path }: { path: string }) => {
        setExpanded((current) => current.filter((item) => item !== path))
    }, [])

    return (
        <TreeComponent
            roots={visibleRoots.map((root) => root.id)}
            filter={treeFilter}
            selected={selected ? [selected.path] : []}
            singleSelection
            expanded={expanded}
            handleExpand={handleExpand}
            handleCollapse={handleCollapse}
            onChange={(payload, event) => {
                event.stopPropagation()
                event.preventDefault()
                if (!payload.checked) {
                    return
                }
                onSelect({
                    id: payload.id,
                    displayName: payload.displayName,
                    path: payload.path,
                })
            }}
        />
    )
}

const OrganisationUnitSearchPagination = ({
    searchHasMore,
    searchLoadingMore,
    searchLoadMoreError,
    onSearchLoadMore,
}: Pick<
    OrganisationUnitSelectorContentProps,
    | 'searchHasMore'
    | 'searchLoadingMore'
    | 'searchLoadMoreError'
    | 'onSearchLoadMore'
>) => {
    if (searchLoadMoreError) {
        return (
            <div className="flex w-full items-center justify-center gap-[8px] pb-[4px] text-[14px] text-[#4a5768]">
                <span>{i18n.t('Could not load more organisation units')}</span>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onSearchLoadMore}
                >
                    {i18n.t('Try again')}
                </Button>
            </div>
        )
    }

    if (!searchHasMore) return null

    return (
        <div className="flex w-full justify-center pb-[4px]">
            <Button
                variant="secondary"
                size="sm"
                data-test="org-unit-search-load-more"
                onClick={onSearchLoadMore}
                disabled={searchLoadingMore}
            >
                {searchLoadingMore && (
                    <Spinner
                        aria-label={i18n.t('Loading')}
                        data-icon="inline-start"
                        className="size-4"
                    />
                )}
                {i18n.t('Show more')}
            </Button>
        </div>
    )
}

const OrganisationUnitSearchResults = ({
    roots,
    allowedPaths,
    selected,
    searchRoots,
    searchLoading,
    searchError,
    onSearchRetry,
    searchHasMore,
    searchLoadingMore,
    searchLoadMoreError,
    onSearchLoadMore,
    treeKey,
    onSelect,
    treeComponent,
}: Omit<
    OrganisationUnitSelectorContentProps,
    'searchValue' | 'onSearchChange'
>) => {
    if (searchLoading) {
        return (
            <Spinner
                aria-label={i18n.t('Loading')}
                className="size-12 border-6"
            />
        )
    }

    if (searchError) {
        return (
            <div
                className="flex w-full flex-col items-center gap-[8px] px-[16px] py-[24px] text-center text-[14px] text-[#4a5768]"
                data-test="org-unit-search-error"
            >
                <span>{i18n.t('Could not search organisation units')}</span>
                {onSearchRetry && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onSearchRetry}
                    >
                        {i18n.t('Try again')}
                    </Button>
                )}
            </div>
        )
    }

    const TreeComponent = treeComponent ?? Dhis2OrganisationUnitTree
    const visibleRoots = searchRoots ?? roots
    // Keep the key stable while search pages append so expanded branches
    // survive; remount only when the term or the browse-mode root set changes.
    const stableTreeKey = searchRoots
        ? treeKey
        : `${treeKey}-${visibleRoots.map((root) => root.id).join('-')}`

    return (
        <>
            <ControlledOrganisationUnitTree
                key={stableTreeKey}
                visibleRoots={visibleRoots}
                allowedPaths={allowedPaths}
                selected={selected}
                onSelect={onSelect}
                TreeComponent={TreeComponent}
            />
            <OrganisationUnitSearchPagination
                searchHasMore={searchHasMore}
                searchLoadingMore={searchLoadingMore}
                searchLoadMoreError={searchLoadMoreError}
                onSearchLoadMore={onSearchLoadMore}
            />
        </>
    )
}

export const OrganisationUnitSelectorContent = ({
    searchValue,
    onSearchChange,
    ...searchResultsProps
}: OrganisationUnitSelectorContentProps) => {
    return (
        <div className="z-0 h-full w-full rounded-[3px] border border-[#e8edf2] bg-white">
            <div className="rounded-t-[3px] bg-[#f8f9fa] p-[8px]">
                <input
                    className={styles.searchInput}
                    data-test="org-unit-search-input"
                    type="text"
                    value={searchValue}
                    placeholder={i18n.t('Search')}
                    onChange={(event) =>
                        onSearchChange(event.currentTarget.value)
                    }
                />
            </div>
            <div className="overflow-auto rounded-b-[3px]">
                <div
                    className={
                        searchResultsProps.searchLoading
                            ? 'm-[4px] flex h-[calc(100vh-48px)] items-center justify-center'
                            : 'flex min-h-[42px] max-w-[100vw] flex-col bg-white p-[4px] pt-[8px]'
                    }
                    data-test="org-unit-tree"
                    data-testid="org-unit-tree"
                >
                    <OrganisationUnitSearchResults {...searchResultsProps} />
                </div>
            </div>
        </div>
    )
}
