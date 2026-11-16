import { z } from 'zod'

/** One design value of the real selector, and the CSS that overrides it. */
export interface DesignControl {
    key: string
    label: string
    kind: 'px' | 'colour' | 'weight' | 'align'
    /** What the block ships with, measured from the running block. */
    initial: number | string
    min?: number
    max?: number
    /** Where the value lands: one or more `selector { property }` pairs. */
    sets: ReadonlyArray<readonly [selector: string, property: string]>
}

export interface DesignGroup {
    title: string
    controls: DesignControl[]
}

export type DesignValues = Record<string, number | string>

const part = (name: string) => `[data-clinic-selector="${name}"]`
const TRIGGER = part('trigger')
const TILE = part('tile')
const ROW = part('row')
const MENU = part('menu')
const MORE = part('more')
const CHECK = `${part('check')} svg, ${MENU} [data-slot="dropdown-menu-radio-item-indicator"] svg`
const ITEM = `${MENU} [data-slot="combobox-item"]:not(${MORE}), ${MENU} [data-slot="dropdown-menu-radio-item"]`
const SEARCH = `${MENU} [data-slot="input-group"]`
const HEADING = `${MENU} [data-slot="combobox-label"]`
const STATUS = part('status')

const px = (
    key: string,
    label: string,
    initial: number,
    max: number,
    ...sets: DesignControl['sets']
): DesignControl => ({ key, label, kind: 'px', initial, min: 0, max, sets })
const colour = (
    key: string,
    label: string,
    initial: string,
    ...sets: DesignControl['sets']
): DesignControl => ({ key, label, kind: 'colour', initial, sets })
const weight = (
    key: string,
    label: string,
    initial: number,
    selector: string
): DesignControl => ({
    key,
    label,
    kind: 'weight',
    initial,
    sets: [[selector, 'font-weight']],
})

/** The theme classes a tile takes, in the order `tileClass` picks them. */
const TILE_COLOURS = [
    ['bg-dhis2-primary', '#1565c0', '#ffffff'],
    ['bg-dhis2-info-fill', '#e3f2fd', '#093371'],
    ['bg-dhis2-success-fill', '#e8f5e9', '#103713'],
    ['bg-dhis2-warning-fill', '#ffecb3', '#6f3205'],
    ['bg-dhis2-selected', '#e0f2f1', '#00695c'],
    ['bg-dhis2-neutral-fill', '#f3f5f7', '#212934'],
] as const

export const DESIGN_GROUPS: DesignGroup[] = [
    {
        title: 'Trigger',
        controls: [
            px('trigger.paddingTop', 'Padding top', 4, 24, [
                TRIGGER,
                'padding-top',
            ]),
            px('trigger.paddingRight', 'Padding right', 4, 24, [
                TRIGGER,
                'padding-right',
            ]),
            px('trigger.paddingBottom', 'Padding bottom', 4, 24, [
                TRIGGER,
                'padding-bottom',
            ]),
            px('trigger.paddingLeft', 'Padding left', 4, 24, [
                TRIGGER,
                'padding-left',
            ]),
            px('trigger.tileGap', 'Gap, tile to name', 8, 24, [
                `${TRIGGER} ${ROW}`,
                'gap',
            ]),
            px('trigger.chevronGap', 'Gap, name to chevron', 8, 24, [
                TRIGGER,
                'gap',
            ]),
            px('trigger.fontSize', 'Font size', 14, 24, [TRIGGER, 'font-size']),
            px('trigger.lineHeight', 'Line height', 20, 36, [
                TRIGGER,
                'line-height',
            ]),
            weight('trigger.fontWeight', 'Font weight', 500, TRIGGER),
            px('trigger.radius', 'Corner radius', 4, 16, [
                TRIGGER,
                'border-radius',
            ]),
            colour('trigger.text', 'Text', '#212934', [TRIGGER, 'color']),
            colour('trigger.hoverBackground', 'Hover background', '#f3f5f7', [
                `${TRIGGER}:hover`,
                'background-color',
            ]),
            colour('trigger.openBackground', 'Open background', '#f3f5f7', [
                `${TRIGGER}[data-popup-open]`,
                'background-color',
            ]),
            colour('trigger.focusRing', 'Focus ring', '#147cd7', [
                `${TRIGGER}:focus-visible`,
                'outline-color',
            ]),
            px('trigger.focusRingWidth', 'Focus ring width', 2, 4, [
                `${TRIGGER}:focus-visible`,
                'outline-width',
            ]),
            px(
                'trigger.chevronSize',
                'Chevron size',
                16,
                24,
                [`${part('chevron')} svg`, 'width'],
                [`${part('chevron')} svg`, 'height']
            ),
            colour('trigger.chevron', 'Chevron', '#212934', [
                part('chevron'),
                'color',
            ]),
        ],
    },
    {
        title: 'Tile',
        controls: [
            px('tile.size', 'Size', 28, 48, [TILE, 'width'], [TILE, 'height']),
            px('tile.radius', 'Corner radius', 4, 24, [TILE, 'border-radius']),
            px('tile.fontSize', 'Initial size', 14, 28, [TILE, 'font-size']),
            weight('tile.fontWeight', 'Initial weight', 500, TILE),
        ],
    },
    {
        title: 'Tile colours',
        controls: TILE_COLOURS.flatMap(([cls, background, text], at) => [
            colour(
                `tileColours.${at + 1}.background`,
                `${at + 1} background`,
                background,
                [`${TILE}.${cls}`, 'background-color']
            ),
            colour(`tileColours.${at + 1}.initial`, `${at + 1} initial`, text, [
                `${TILE}.${cls}`,
                'color',
            ]),
        ]),
    },
    {
        title: 'Menu',
        controls: [
            {
                ...px('menu.width', 'Width', 400, 640, [MENU, 'width']),
                min: 200,
            },
            {
                ...px('menu.listMaxHeight', 'List max height', 236, 640, [
                    `${MENU} [data-slot="combobox-list"]`,
                    'max-height',
                ]),
                min: 120,
            },
            px('menu.radius', 'Corner radius', 3, 16, [MENU, 'border-radius']),
            colour('menu.background', 'Background', '#ffffff', [
                MENU,
                'background-color',
            ]),
            colour('menu.border', 'Border', '#e8edf2', [MENU, 'border-color']),
        ],
    },
    {
        title: 'Search box',
        controls: [
            {
                ...px('search.height', 'Height', 32, 48, [SEARCH, 'height']),
                min: 24,
            },
            px('search.marginTop', 'Margin top', 8, 24, [SEARCH, 'margin-top']),
            px('search.marginSides', 'Margin sides', 8, 24, [
                SEARCH,
                'margin-inline',
            ]),
            px('search.marginBottom', 'Margin bottom', 4, 24, [
                SEARCH,
                'margin-bottom',
            ]),
            px('search.paddingStart', 'Padding start', 12, 24, [
                `${SEARCH} input`,
                'padding-inline-start',
            ]),
            px('search.fontSize', 'Font size', 14, 20, [
                `${SEARCH} input`,
                'font-size',
            ]),
            px('search.radius', 'Corner radius', 3, 16, [
                SEARCH,
                'border-radius',
            ]),
            colour('search.border', 'Border', '#a0adba', [
                SEARCH,
                'border-color',
            ]),
        ],
    },
    {
        title: 'Group heading',
        controls: [
            px('heading.fontSize', 'Font size', 13, 18, [HEADING, 'font-size']),
            weight('heading.fontWeight', 'Font weight', 500, HEADING),
            colour('heading.text', 'Text', '#4a5768', [HEADING, 'color']),
            px('heading.paddingTop', 'Padding top', 8, 24, [
                HEADING,
                'padding-top',
            ]),
            px('heading.paddingBottom', 'Padding bottom', 4, 24, [
                HEADING,
                'padding-bottom',
            ]),
            px('heading.paddingSides', 'Padding sides', 12, 24, [
                HEADING,
                'padding-inline',
            ]),
        ],
    },
    {
        title: 'Menu row',
        controls: [
            px('row.paddingTop', 'Padding top', 8, 20, [ITEM, 'padding-top']),
            px('row.paddingBottom', 'Padding bottom', 8, 20, [
                ITEM,
                'padding-bottom',
            ]),
            px('row.paddingStart', 'Padding start', 12, 32, [
                ITEM,
                'padding-inline-start',
            ]),
            px('row.paddingEnd', 'Padding end', 36, 56, [
                ITEM,
                'padding-inline-end',
            ]),
            px('row.tileGap', 'Gap, tile to name', 8, 24, [
                `${MENU} ${ROW}`,
                'gap',
            ]),
            px('row.fontSize', 'Font size', 14, 20, [ITEM, 'font-size']),
            px('row.lineHeight', 'Line height', 21, 36, [ITEM, 'line-height']),
            weight('row.fontWeight', 'Font weight', 400, ITEM),
            colour('row.text', 'Text', '#212934', [ITEM, 'color']),
            colour(
                'row.highlightBackground',
                'Highlighted background',
                '#f3f5f7',
                [`${MENU} [data-highlighted]`, 'background-color']
            ),
            colour(
                'row.currentBackground',
                'Current clinic background',
                '#ffffff',
                [
                    `${MENU} [data-slot="combobox-item"][data-selected]:not([data-highlighted])`,
                    'background-color',
                ]
            ),
            colour('row.check', 'Check', '#00695c', [CHECK, 'color']),
            px(
                'row.checkSize',
                'Check size',
                16,
                24,
                [CHECK, 'width'],
                [CHECK, 'height']
            ),
            px('row.checkInset', 'Check inset from the end', 12, 24, [
                part('check'),
                'inset-inline-end',
            ]),
        ],
    },
    {
        title: 'Show more row',
        controls: [
            px('more.fontSize', 'Font size', 14, 20, [MORE, 'font-size']),
            weight('more.fontWeight', 'Font weight', 500, MORE),
            colour('more.text', 'Text', '#1565c0', [MORE, 'color']),
            px('more.paddingTop', 'Padding top', 8, 20, [MORE, 'padding-top']),
            px('more.paddingBottom', 'Padding bottom', 8, 20, [
                MORE,
                'padding-bottom',
            ]),
            px('more.paddingSides', 'Padding sides', 12, 32, [
                MORE,
                'padding-inline',
            ]),
            {
                key: 'more.align',
                label: 'Alignment',
                kind: 'align',
                initial: 'center',
                sets: [[MORE, 'justify-content']],
            },
        ],
    },
    {
        title: 'Loading, failed, none',
        controls: [
            px('status.fontSize', 'Message size', 14, 18, [
                STATUS,
                'font-size',
            ]),
            colour('status.text', 'Message text', '#212934', [STATUS, 'color']),
            px('status.gap', 'Gap', 8, 24, [STATUS, 'gap']),
        ],
    },
]

const CONTROLS = DESIGN_GROUPS.flatMap((group) => group.controls)

export const DESIGN_DEFAULTS: DesignValues = Object.fromEntries(
    CONTROLS.map((control) => [control.key, control.initial])
)

const cssValue = (control: DesignControl, value: number | string) =>
    control.kind === 'px' ? `${value}px` : String(value)

export const changedControls = (values: DesignValues) =>
    CONTROLS.filter((control) => values[control.key] !== control.initial)

/** What the lab shows on top of the block's own states. */
export interface DesignForce {
    hovered: boolean
    focused: boolean
}

/** Overrides for the values that differ from the block's own, so an untouched value is the block as it ships. */
export const designCss = (values: DesignValues, force: DesignForce) => {
    const rules = changedControls(values).flatMap((control) =>
        control.sets.map(
            ([selector, property]) =>
                `${selector} { ${property}: ${cssValue(control, values[control.key] ?? control.initial)} !important; }`
        )
    )
    const ring = values['trigger.focusRingWidth']
    if (
        values['trigger.focusRingWidth'] !==
        DESIGN_DEFAULTS['trigger.focusRingWidth']
    ) {
        // The ring sits inside the trigger's edge, whatever its width.
        rules.push(
            `${TRIGGER}:focus-visible { outline-offset: -${ring}px !important; }`
        )
    }
    if (force.hovered) {
        rules.push(
            `${TRIGGER} { background-color: ${values['trigger.hoverBackground']} !important; }`
        )
    }
    if (force.focused) {
        rules.push(
            `${TRIGGER} { outline: ${ring}px solid ${values['trigger.focusRing']} !important; outline-offset: -${ring}px !important; }`
        )
    }
    return rules.join('\n')
}

/** What to paste back: the changes first, then every value. */
export const designSpec = (values: DesignValues) => {
    const unit = (control: DesignControl) => (control.kind === 'px' ? 'px' : '')
    const changed = changedControls(values).map(
        (control) =>
            `${control.key}: ${control.initial}${unit(control)} -> ${values[control.key]}${unit(control)}`
    )
    return [
        'Clinic selector design values (px unless a colour or a keyword)',
        '',
        `Changed from the block as it ships (${changed.length}):`,
        ...(changed.length > 0 ? changed : ['nothing']),
        '',
        'All values:',
        JSON.stringify(values, null, 2),
    ].join('\n')
}

const STORED = 'dhis2-blocks:clinic-selector-lab:design'

const StoredSchema = z.record(z.string(), z.union([z.number(), z.string()]))

/** A stored value counts only for a control that still exists and takes that kind of value. */
const fits = (control: DesignControl, value: number | string) =>
    z.number().safeParse(value).success ===
    (control.kind === 'px' || control.kind === 'weight')

/** What storage holds, or nothing when it is unreadable or not a set of values. */
const readStored = () => {
    try {
        return StoredSchema.safeParse(
            JSON.parse(localStorage.getItem(STORED) ?? '{}')
        ).data
    } catch {
        return undefined
    }
}

export const readDesign = () => {
    const stored = readStored() ?? {}
    const values = { ...DESIGN_DEFAULTS }
    CONTROLS.forEach((control) => {
        const value = stored[control.key]
        if (value !== undefined && fits(control, value)) {
            values[control.key] = value
        }
    })
    return values
}

export const writeDesign = (values: DesignValues) => {
    try {
        localStorage.setItem(STORED, JSON.stringify(values))
    } catch {
        // The lab works without storage; the values last until the page closes.
    }
}
