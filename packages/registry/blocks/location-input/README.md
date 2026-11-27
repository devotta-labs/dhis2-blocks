# Location Input

A location as one form field, the height of the others. `capture="point"`: a coordinate typed or pasted (latitude
first, degrees and minutes, the stored `[lng,lat]` or a maps link), the device's position, or placed on a map that
opens from the field. `capture="area"`: points added where the user stands, one press per corner, pasted as a list or
a GeoJSON polygon, or drawn on the map.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/location-input
```

`value` and `onChange` use GeoJSON, as DHIS2 stores an event's, an enrollment's or a tracked entity's geometry.
Fewer than three points is not an area: the field keeps them and sends `null` until there are three. An area with
holes or several parts is shown and kept, never edited.

"Use my location" watches the device until a fix is within 10 metres, or for 10 seconds, and takes the best one, since
a browser's first answer is often a coarse one from Wi-Fi; pressing again takes the best so far. The accuracy is said
in words under the field. With `orgUnit`, the box says where the location is in words a health worker knows rather than
as coordinates: `350 m north-east of Ngelehun CHC`, `Inside Badjia`, `3.7 ha · inside Badjia`, with `Your location`
in front of a point just taken from the device. The coordinates come back while the box has focus, for typing and
pasting, are read out with the field, and stay in the box when there is a warning about them. It also offers
`At <name>` on the map; with `warnKm`, a point further away is a warning that names the
usual cause, latitude and longitude swapped. Nothing is ever held back for being far.

The map opens as a popover under the field, or as a sheet on a phone, and is the `location-map` block, loaded only
when opened. Alt+Down opens it from the field. `locator` replaces the browser's geolocation, to test or simulate.

With `search`, the map gets a search box. It searches when the user presses Enter, and an Enter key at its end shows
that once there is text; choosing a place puts a point there, or brings an area's map to it. `nominatimSearch` searches
OpenStreetMap's public Nominatim server, whose usage policy allows a search on request, about one a second across all
of an app's users, none as the user types, and expects the app to be able to turn it off when asked. What people type
goes to that server. Pass it, your own instance, or a search of your own, such as one over org units.
