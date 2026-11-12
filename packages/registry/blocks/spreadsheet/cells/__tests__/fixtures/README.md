# Cell fixtures

What the searching and uploading cells get from DHIS2, captured from the docs DHIS2 (Sierra Leone demo, version 2.42.6,
revision dd8bdbb), started with `pnpm docs:up`. Run from the repository root:

```bash
D=packages/registry/blocks/spreadsheet/cells/__tests__/fixtures; B=http://127.0.0.1:58080/api
curl -s -u admin:district -G "$B/organisationUnits" -d query=ngelehun -d withinUserSearchHierarchy=true --data-urlencode "fields=id,displayName,ancestors[displayName]" > $D/org-unit-search.json
curl -s -u admin:district -G "$B/userLookup" -d query=admin > $D/user-lookup.json
pnpm exec oxfmt --write $D
```

The search requests were captured on 2026-10-27. `org-unit-search.json` is the org unit editor's search:
`withinUserSearchHierarchy=true` keeps it to the user's search scope, and `ancestors[displayName]` returns each result's
path as names, from the top of the hierarchy down, in the same request; `pager.total` counts every match (the first 50
are sent). A search that finds nothing answers
`{"pager":{"page":1,"total":0,"pageSize":50,"pageCount":0},"organisationUnits":[]}`. `user-lookup.json` is the username
editor's search: `userLookup` sends at most 25 users, without a pager, and `{"users":[]}` for none.

The file fixtures were captured on 2026-10-29 from the same server:

```bash
curl -s -u admin:district -F "file=@data-entry-check.txt;type=text/plain" -F domain=DATA_VALUE "$B/fileResources" > $D/file-upload.json
curl -s -u admin:district -F "file=@tiny.txt;type=text/plain" -F domain=NOT_A_DOMAIN "$B/fileResources" > $D/file-upload-refused.json
curl -s -u admin:district -G "$B/fileResources/Yqp5K9rz3I2" -d fields=name > $D/file-name.json
```

`file-upload.json` is a real upload of a one-byte text file: DHIS2 answers HTTP 202 with the file resource, unassigned
(`assigned: false`) until an event saves its id. The API has no way to delete a file resource (`DELETE` answers 405), so
`lzVZJQy3Eqi` was left unassigned for DHIS2's clean-up of unassigned file resources; validating a new event that holds
it (`importMode=VALIDATE`) passes. Don't run that line again without need: each run leaves another file on the server.
`file-upload-refused.json` is a refused upload, which creates nothing: HTTP 400 with DHIS2's reason in `message`. An
upload without its file part answers an HTML page instead. `file-name.json` is the name read for a stored file
(`doc.pdf` of the inpatient event `TB1aevraoff`). `/api/fileResources/{id}/data` refuses a data value's file (403).
