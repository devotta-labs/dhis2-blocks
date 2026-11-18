# DHIS2 Value Input

A form control for each DHIS2 value type, accepting what the grid accepts, in the system calendar.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/dhis2-value-input
```

`ValueInput` takes a `field` (value type, options, field mask), the `settings` (calendar and date format), a `label`
and the stored `value`. `onChange(value, problem?)` fires when a value is committed (blur, Enter, a pick), never per
keystroke; a `problem` means the typed text is not a value yet. A host passes what its rules say as `required`,
`readOnly`, `hiddenOptions` and `messages`. `labelAside` puts something of the host's on the label's row, outside the
control's name, and `readOnlyReason="described"` keeps the `readOnly` reason in the control's accessible description
without showing it, for a host that shows it another way, such as a marker there; Tab then passes the control for the
marker, and a script can still focus it. `readOnlyReason="held"` describes it too and keeps the field
drawn as when it can be edited, a pop-up editor, search or calendar button there but inert, for a host that locks it for a moment. A `value` other than the one last reported replaces the typed text and any
problem; the one last reported (a problem reports `null`) changes nothing. A host gives the control a new React `key`
to reset it, such as emptying it after a problem, or to show two different fields with one instance when they share a
value type and options.

Search and file fields need the DHIS2 app-runtime provider. The pop-up editors, `createFileUploads` and the server
search are exported for blocks that build their own editing surface, as `spreadsheet` does. See `/blocks/dhis2-value-input`
in the docs for the props, the kinds and examples.
