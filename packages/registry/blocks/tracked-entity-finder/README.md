# Tracked Entity Finder

Composable parts and hooks for DHIS2 React 18 applications that find one
tracked entity within a program's search rules. The host places the parts it
wants; the block enforces the program's rules invisibly and they cannot be
loosened: the minimum number of attributes to search with, exact matching for
IDs, the result cap, and which attributes are searchable. A field that does
not fit the program's metadata is left out of the search and shows a message in
its place.

```tsx
<FinderProvider program={programId} onSelect={openPerson}>
    <FinderForm>
        <FinderField attribute="lZGmxYbs97q" />
        <FinderField attribute="w75KJ2mc4zz" />
        <FinderRangeField attribute="iESIqZ0R0R0" />
        <FinderHint />
        <FinderSubmit />
    </FinderForm>

    <FinderResults>
        <FinderSearching />
        <FinderEmpty />
        <FinderTooMany />
        <FinderError />
        <FinderList>
            <FinderItem>
                <FinderValue attribute="w75KJ2mc4zz" />
            </FinderItem>
        </FinderList>
        <FinderPagination />
    </FinderResults>
</FinderProvider>
```

Parts: `FinderProvider`, `FinderForm`, `FinderField`, `FinderRangeField`,
`FinderHint`, `FinderSubmit`, `FinderResults`, `FinderSearching`,
`FinderEmpty`, `FinderTooMany`, `FinderError`, `FinderList`, `FinderItem`,
`FinderValue`, `FinderPagination`.

Hooks, for custom layouts: `useFinderField`, `useFinderRangeField`,
`useFinderForm`, `useFinderSearch`, `useFinderResults`, `useFinderPerson`,
`useFinderProgram`.

Each `FinderForm` is a TanStack Form, and each field checks its value with a
Zod schema built from the attribute's metadata. `useFinderForm` returns the
form; `useFinderField` returns the attribute's TanStack `field`, its `error`
and any `metadataError`, so a custom input counts toward the search like
the built-in ones.

The block reads DHIS2 app-runtime's `useDataEngine` and runs every request in
a TanStack Query `queryFn`. Tests can use app-runtime's `CustomDataProvider`.

Program metadata and system info stay fresh for 3 hours. Search results stay
fresh for 5 minutes, keyed by server URL, program, filters and page, including
across repeated submissions and finder remounts within the same QueryClient.
Different server URLs never share cached metadata or results. As with the
rest of an app's queries, clear the QueryClient when the signed-in user changes.

To list a program's searchable attributes and their uids:

```
GET /api/programs/<program>?fields=name,minAttributesRequiredToSearch,programTrackedEntityAttributes[searchable,displayInList,trackedEntityAttribute[id,displayName,valueType,unique]]
```

The block reads the literal `process.env.NODE_ENV`, which your bundler
replaces at build time, to choose between the full development metadata-error
messages and the short production ones (the full message is logged instead).
Where nothing replaces it, the full messages show.

See the docs page at `/blocks/tracked-entity-finder` for every part, hook and
example.
