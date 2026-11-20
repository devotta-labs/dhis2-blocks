# DHIS2 Value Input

A form control for each DHIS2 value type, accepting what the grid accepts, in the system calendar.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/dhis2-value-input
```

`ValueInput` takes a `field` (value type, options, field mask), the `settings` (calendar and date format), a `label`
and the stored `value`. `onChange(value, problem?)` fires when a value is committed (blur, Enter, a pick), never per
keystroke; a `problem` means the typed text is not a value yet. A host passes what its rules say as `required`,
`readOnly`, `hiddenOptions` and `messages`. A `value` other than the one last reported replaces the typed text and any
problem; the one last reported (a problem reports `null`) changes nothing. A host gives the control a new React `key`
to reset it, such as emptying it after a problem, or to show two different fields with one instance when they share a
value type and options.

Search and file fields need the DHIS2 app-runtime provider. The pop-up editors, `createFileUploads` and the server
search are exported for blocks that build their own editing surface, as `spreadsheet` does. See `/blocks/dhis2-value-input`
in the docs for the props, the kinds and examples.

Pop-up and form editors share a few host callbacks. `report(value, problem?)` runs on every edit. The host commits
when focus leaves, or keeps the problem's text as the draft if it cannot be saved. Without a `problem`, reporting
`null` means the field is empty; with a `problem`, it means the draft is invalid, not that the value should be cleared.
`save(null)` requests a clear. `save(value)` returns `invalid` for a refused save, `unchanged` for the stored value,
or `queued` when accepted. An optional `announce` callback replaces the shared screen-reader announcer.

File and image editors show the stored id when no `fileName` is provided. A `fileUrl` enables preview and download.
Set `offline` when the server is unreachable to block uploads. Supply `uploads` to share upload state with the host,
or let each editor own and cancel its uploads when it unmounts.
