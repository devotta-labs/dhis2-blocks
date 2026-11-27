# Location Map

A point or an area on a map. Without `onChange` it only shows what it is given, for a dashboard, a person's header or
a summary. With `onChange`, a click places the point or adds a corner, a drag moves either, the handle in the middle
of a side inserts a corner, and the selected corner can be removed. While an area is drawn, dashed sides follow the
pointer from the corners a click would join, and clicking the first corner again closes it; a closed area is reshaped by
its handles, and a click on the map no longer adds corners. With the map focused, Enter places at the
crosshair, and a focused pin or corner moves with the arrow keys (Shift for further) and is removed with Delete.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/location-map
```

`value` is GeoJSON as DHIS2 stores it: a `Point`, a `Polygon` with one ring (editable), or a `Polygon` with holes or a
`MultiPolygon` (shown, never edited). `capture` says what an empty map captures. `references` are drawn quietly for
orientation, such as an org unit's point or boundary; `here` is the device's position with its accuracy; `zoom` sets the level it opens at, centred on what it shows, instead of fitting it; `frame` brings positions into view when it changes, such as a place found by a search. `tiles` is
the background; it is OpenStreetMap's standard tiles by default, which allow no bulk or offline use, and `null` draws
none. The map keeps working with no background: what is recorded, the references and the scale stay.

Leaflet and its styles load the first time a map is drawn. Size the map with `className`; it is
`var(--location-map-height, 24rem)` tall otherwise. Its look is set by the `--location-*` variables at the top of
`location-map.css`, which can be set on `:root` or any element around it.

The geometry helpers it uses are exported too: distances, bearing, area size, whether a point is inside an area,
whether a boundary crosses itself, and where a new corner best goes.
