# Context Selector composition

## Consumer contract

The Context Selector is a source-installed React 18 block. Install it into a
Tailwind-enabled project with a valid shadcn `components.json`, then import it
through the configured components alias. The installed components own their
styling through Tailwind utility classes and DHIS2 UI primitives; no separate
stylesheet import is required.

The block is deliberately presentational. `ContextSelector` owns the visual
and semantic row modeled on the DHIS2 Capture context selector. Selector
children own the matching control and popup presentation. There is no provider,
query client, store, router adapter, or hidden application context inside the
block.

The host application owns:

- available programs, organisation units, enrollments, stages, and other
  context data;
- loading, disabled, error, empty, open, and selected state;
- transition callbacks, dirty-state confirmation, and dependent-selection
  resets;
- URL or router synchronization and any persistence;
- child order and progressive-disclosure policy.

Each selector emits user intent through callbacks. The host commits a
transition by passing the resulting controlled state back. This boundary keeps
the same visual controls usable with TanStack Query, another data layer, or
preloaded data without coupling the registry block to any of them.

Import the specialized controls, the generic option control, or the display
primitives needed by the host composition:

```tsx
import {
    ContextDisplayItem,
    ContextEnrollmentSelector,
    ContextOptionLabel,
    ContextOptionSelector,
    ContextOrganisationUnitSelector,
    ContextProgramSelector,
    ContextSelector,
    ContextStageSelector,
} from '@/components/context-selector'
```

## Composition and progressive disclosure

Progressive disclosure is expressed with ordinary conditional rendering. A
program-first workflow should render the program control initially, reveal the
organisation-unit control when the selected program requires it, then reveal
enrollment, stage, or related controls only when the host determines that each
one is applicable.

The component does not infer that sequence. For example, an event program may
need program and organisation-unit controls but no enrollment selector; a
tracker workflow may expose an enrollment before a stage; another application
may omit the program selector because the route fixes the program. These are
host policies, not presentation variants.

A minimal program-first composition can be expressed directly in JSX. The
state and option data in this example belong to the host:

```tsx
const [programOpen, setProgramOpen] = useState(false)
const [organisationUnitOpen, setOrganisationUnitOpen] = useState(false)

<ContextSelector
    ariaLabel="Registration context"
    clearAction={{
        disabled: !selectedProgramId,
        onClick: clearCommittedContext,
    }}
>
    <ContextProgramSelector
        options={programOptions}
        selectedValue={selectedProgramId}
        control={
            programsQuery.isPending
                ? {
                      mode: 'loading',
                      loadingLabel: 'Loading tracker programs…',
                  }
                : {
                      mode: 'interactive',
                      open: programOpen,
                      onOpenChange: setProgramOpen,
                      onSelect: selectProgram,
                      onClear: clearProgram,
                  }
        }
    />

    {selectedProgramId && (
        <ContextOrganisationUnitSelector
            value={selectedOrganisationUnitName}
            control={
                organisationUnitsQuery.isPending
                    ? { mode: 'loading' }
                    : organisationUnitRoots.length === 0
                      ? { mode: 'disabled' }
                      : {
                            mode: 'interactive',
                            open: organisationUnitOpen,
                            onOpenChange: setOrganisationUnitOpen,
                            onClear: clearOrganisationUnit,
                        }
            }
        >
            <OrganisationUnitTree
                roots={organisationUnitRoots}
                selected={selectedOrganisationUnitPath}
                onSelect={selectOrganisationUnit}
            />
        </ContextOrganisationUnitSelector>
    )}

    {enrollmentIsRelevant && (
        <ContextEnrollmentSelector
            options={enrollmentOptions}
            selectedValue={selectedEnrollmentId}
            control={enrollmentControl}
        />
    )}

    {stageIsRelevant && (
        <ContextStageSelector
            options={stageOptions}
            selectedValue={selectedStageId}
            control={stageControl}
        />
    )}
</ContextSelector>
```

The conditional expressions are intentionally outside every selector. Query
results are converted by the host to `{ value, label }` options. Opening,
selection, and clearing remain controlled through the discriminated `control`
prop, so loading and disabled controls cannot accidentally receive active
selection handlers.

Option selectors accept four explicit modes: `interactive`, `display`,
`loading`, and `disabled`. The interactive branch requires the open state,
`onOpenChange`, and `onSelect`; it may also supply `onClear`. The other branches
cannot carry selection handlers. The organisation-unit selector uses the same
presentation modes but leaves selection inside its host-supplied picker
content, so its interactive popup contract needs only controlled open state and
an optional clear callback.

The children may be omitted, reordered, or replaced with a custom child while
`ContextSelector` continues to provide the Capture-compatible row. The
specialized program, enrollment, and stage controls share the generic option
selector contract. The organisation-unit control accepts host-rendered picker
content so applications can supply the appropriate tree, scope rules, and
query behavior without hiding those decisions in the block.

## State and data boundaries

Keep server-state queries near the host workflow that understands their
dependencies. Program selection commonly enables an organisation-unit query;
program and organisation-unit selection may enable enrollment queries; stage
options may depend on the selected program and enrollment. Query keys and
enablement rules therefore remain outside the installed block.

Use one committed context object in the host when transitions need to clear
downstream selections atomically. A program transition can clear organisation
unit, enrollment, and stage before the host renders the next relevant controls.
An organisation-unit transition can clear an enrollment while retaining the
program. If navigation or unsaved work requires confirmation, keep the pending
selection in the host and update the committed props only after confirmation.

URL synchronization follows the same boundary: decode route state into host
selection props, validate it against loaded options, and encode confirmed
callback results back into the URL. Selector primitives neither read nor write
the URL.

## Capture parity boundary

Capture is the visual and behavioral reference for selector-bar structure,
labels and values, clear affordances, popup state, truncation, disabled state,
responsive layout, and keyboard-accessible interaction. Parity does not mean
copying Capture's application-specific Redux, routing, metadata loading, or
workflow orchestration. Those responsibilities are supplied by the host while
the block recreates the user-visible controls with this repository's React,
Tailwind, and DHIS2 UI stack.

Structural components expose explicit labeling, test, and styling hooks rather
than relying on hidden application state.

## Public surface

The source entry point exports `ContextSelector`, `ContextOptionSelector`,
`ContextProgramSelector`, `ContextEnrollmentSelector`,
`ContextStageSelector`, `ContextOrganisationUnitSelector`,
`ContextDisplayItem`, and `ContextOptionLabel`. It also exports their prop
contracts plus `ContextSelectorClearAction`, `ContextOption`, `ContextIcon`,
`ContextControlMode`, and `ContextPopupMode` for typed host abstractions.

Use the specialized selectors for Capture-compatible default labels and
messages. Use `ContextOptionSelector` for another option-backed context field,
`ContextDisplayItem` for a non-selectable value, and `ContextOptionLabel` when a
host option needs the block's icon-and-label treatment.
