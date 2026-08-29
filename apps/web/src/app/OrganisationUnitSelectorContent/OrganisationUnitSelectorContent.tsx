import { CircularLoader, OrganisationUnitTree } from '@dhis2/ui'
import React, { useMemo } from 'react'
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
    treeKey: string
    onSelect: (organisationUnit: OrganisationUnitReference) => void
}

/** Host-owned TanStack-backed tree content composed into the selector popover. */
export const OrganisationUnitSelectorContent = ({
    roots,
    allowedPaths,
    selected,
    searchValue,
    onSearchChange,
    searchRoots,
    searchLoading = false,
    treeKey,
    onSelect,
}: OrganisationUnitSelectorContentProps) => {
    const visibleRoots = searchRoots ?? roots
    const treeFilter = useMemo(
        () => buildOrganisationUnitTreeFilter(allowedPaths, visibleRoots),
        [allowedPaths, visibleRoots]
    )
    const initiallyExpanded = useMemo(
        () =>
            getInitialOrganisationUnitExpandedPaths(
                visibleRoots,
                selected?.path
            ),
        [selected?.path, visibleRoots]
    )

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
                        searchLoading
                            ? 'm-[4px] flex h-[calc(100vh-48px)] items-center justify-center'
                            : 'flex min-h-[42px] max-w-[100vw] bg-white p-[4px] pt-[8px]'
                    }
                    data-test="org-unit-tree"
                    data-testid="org-unit-tree"
                >
                    {searchLoading ? (
                        <CircularLoader />
                    ) : (
                        <OrganisationUnitTree
                            key={`${treeKey}-${visibleRoots.map((root) => root.id).join('-')}`}
                            roots={visibleRoots.map((root) => root.id)}
                            filter={treeFilter}
                            selected={selected ? [selected.path] : []}
                            singleSelection
                            initiallyExpanded={initiallyExpanded}
                            onChange={(payload) => {
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
                    )}
                </div>
            </div>
        </div>
    )
}
