# Event source fixtures

Captured on 2026-10-26 from the docs DHIS2 (Sierra Leone demo, version 2.42.6, revision dd8bdbb), started with
`pnpm docs:up`. Run from the repository root:

```bash
D=packages/registry/blocks/data-entry/sources/__tests__/fixtures; B=http://127.0.0.1:58080/api
P='id,displayName,programType,expiryPeriodType,expiryDays,completeEventsExpiryDays,categoryCombo[id,isDefault],programStages[id,displayName,repeatable,validationStrategy,blockEntryForm,access[data[write]],programStageDataElements[compulsory,dataElement[id,displayFormName,valueType,fieldMask,optionSet[options[code,displayName]]]],programStageSections[id,dataElements[id]]]'
E='event,enrollment,program,programStage,orgUnit,occurredAt,scheduledAt,completedAt,status,attributeOptionCombo,dataValues[dataElement,value]'
curl -s -u admin:district "$B/me?fields=id,authorities" > $D/me-admin.json
curl -s -u admin:district "$B/system/info?fields=calendar" > $D/system-info.json
curl -s -u admin:district -G "$B/programs/eBAyeGv0exc" --data-urlencode "fields=$P" | jq '(.. | objects | select(has("options")) | .options) |= .[:20]' > $D/inpatient-program.json
curl -s -u admin:district -G "$B/tracker/events" -d program=eBAyeGv0exc -d orgUnit=DiszpKrYNg8 -d pageSize=5 -d order=occurredAt:desc --data-urlencode "fields=$E" > $D/inpatient-events.json
curl -s -u admin:district -G "$B/programs/WSGAb5XwJ3Y" --data-urlencode "fields=$P" > $D/rmnch-program.json
curl -s -u admin:district -G "$B/tracker/events" -d program=WSGAb5XwJ3Y -d enrollments=PE6abx7Zhn0 -d pageSize=50 -d order=occurredAt:asc --data-urlencode "fields=$E" > $D/rmnch-person-events.json
I='{"events":[{"event":"NGxc7JpmqqD","program":"eBAyeGv0exc","programStage":"Zj7UnCAulEk","orgUnit":"DiszpKrYNg8","occurredAt":"2026-12-25","status":"COMPLETED","dataValues":[{"dataElement":"qrur9Dvnyt5","value":"6"},{"dataElement":"GieVkTxp4HH","value":null}]},{"event":"wAiGPfJGMxt","program":"eBAyeGv0exc","programStage":"Zj7UnCAulEk","orgUnit":"DiszpKrYNg8","occurredAt":"2026-12-18","status":"COMPLETED","dataValues":[{"dataElement":"qrur9Dvnyt5","value":"abc"}]}]}'
U="$B/tracker?async=false&importStrategy=CREATE_AND_UPDATE&importMode=VALIDATE"
curl -s -u admin:district -H 'Content-Type: application/json' -d "$I" "$U&atomicMode=OBJECT" > $D/import-one-refused.json
curl -s -u admin:district -H 'Content-Type: application/json' -d "$I" "$U&atomicMode=ALL" > $D/import-all-refused.json
curl -s -u admin:district -G "$B/organisationUnits" -d "filter=id:in:[DiszpKrYNg8,FwKJ7gYEv8U]" -d paging=false -d fields=id,displayName > $D/org-unit-names.json
curl -s -u admin:district -G "$B/organisationUnits" -d query=ngelehun -d withinUserSearchHierarchy=true --data-urlencode "fields=id,displayName,ancestors[displayName]" > $D/org-unit-search.json
curl -s -u admin:district -G "$B/userLookup" -d query=admin > $D/user-lookup.json
pnpm exec oxfmt --write $D
```

`inpatient-program.json` keeps only the first 20 options of each option set. The diagnosis option set has 14,240
options, and the full response is 3.2 MB once formatted.

The two import reports validate one valid update and one age that is not a number without writing anything
(`importMode=VALIDATE`; `/api/tracker` ignores `dryRun`). With `atomicMode=OBJECT` DHIS2 answers HTTP 200 with status
`OK` and reports the refused event by its id (a committed import saves the other); with `atomicMode=ALL` it answers
HTTP 409 with status `ERROR` and saves neither.

The org unit and user requests were captured on 2026-10-27 from the same server. `org-unit-names.json` is a request a
load makes for the names of the org units its values hold (no inpatient event on the server holds one; the test adds
them). A load asks for 200 ids a request: the request line and headers must stay under about 8 KB, and on 2026-10-29
`curl` (with few headers) got HTTP 200 for 650 ids and HTTP 400 for 700, while a browser, with its cookies and
headers, is refused sooner. `org-unit-search.json` is the org unit editor's search: `withinUserSearchHierarchy=true` keeps it to
the user's search scope, and `ancestors[displayName]` returns each result's path as names, from the top of the
hierarchy down, in the same request; `pager.total` counts every match (the first 50 are sent). A search that finds
nothing answers `{"pager":{"page":1,"total":0,"pageSize":50,"pageCount":0},"organisationUnits":[]}`. `user-lookup.json`
is the username editor's search: `userLookup` sends at most 25 users, without a pager, and `{"users":[]}` for none.

The file fixtures were captured on 2026-10-29 from the same server:

```bash
curl -s -u admin:district -F "file=@data-entry-check.txt;type=text/plain" -F domain=DATA_VALUE "$B/fileResources" > $D/file-upload.json
curl -s -u admin:district -F "file=@tiny.txt;type=text/plain" -F domain=NOT_A_DOMAIN "$B/fileResources" > $D/file-upload-refused.json
curl -s -u admin:district -G "$B/fileResources/Yqp5K9rz3I2" -d fields=name > $D/file-name.json
curl -s -u admin:district -G "$B/fileResources" --data-urlencode "filter=id:in:[Yqp5K9rz3I2,KV56VHt4vhw]" -d fields=id,name -d paging=false > $D/file-names.json
```

`file-upload.json` is a real upload of a one-byte text file: DHIS2 answers HTTP 202 with the file resource, unassigned
(`assigned: false`) until an event saves its id. The API has no way to delete a file resource (`DELETE` answers 405), so
`lzVZJQy3Eqi` was left unassigned for DHIS2's clean-up of unassigned file resources; validating a new event that holds
it (`importMode=VALIDATE`) passes. Don't run that line again without need: each run leaves another file on the server.
`file-upload-refused.json` is a refused upload, which creates nothing: HTTP 400 with DHIS2's reason in `message`. An
upload without its file part answers an HTML page instead. `file-name.json` is the name read for a stored file
(`doc.pdf` of the inpatient event `TB1aevraoff`). DHIS2 serves an event's file at
`/api/tracker/events/{event}/dataValues/{dataElement}/file`, and an image at `.../image` (`dimension` optional); for
that event they answer 409 "The content is being processed and is not available yet" and 400 "File is not an image",
since the demo database holds no file content. `/api/fileResources/{id}/data` refuses a data value's file (403).
`file-names.json` is the request a load makes for the names of the files its values hold: with `paging=false` the
answer has no pager. The seeded non-admin `wl_e2e_reader`, a role with no authorities, gets the same answer (HTTP 200).
The image endpoint's `dimension` is one of `SMALL`, `MEDIUM`, `LARGE` and `ORIGINAL`, in any case.
