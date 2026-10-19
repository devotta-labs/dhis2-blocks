#!/usr/bin/env bash
# Fetch RMNCH rule fixtures from the e2e DHIS2 42 stack.
set -euo pipefail
B="${DHIS2_URL:-http://127.0.0.1:58442}/api"
P=WSGAb5XwJ3Y
S=WZbXY0S00lP
F="$(dirname "$0")/../fixtures"
mkdir -p "$F"
get() { curl -sfg -u admin:district "$B/$1"; }
get "constants?fields=id,name,displayName,value&paging=false" > "$F/constants.json"
get "programStages/$S?fields=id,name,displayName,programStageDataElements[compulsory,dataElement[id,name,formName,valueType,optionSet[id,options[id,code,name,displayName]]]],programStageSections[id,name,dataElements[id]]" > "$F/stage.json"
get "me?fields=id,username,userRoles[id],userGroups[id],organisationUnits[id]" > "$F/me.json"
EN="${ENROLLMENT:-PE6abx7Zhn0}"
get "tracker/enrollments/$EN?fields=*,attributes,events[*]" > "$F/enrollment.json"
OU=$(jq -r .orgUnit "$F/enrollment.json")
get "organisationUnits/$OU?fields=id,code,name,organisationUnitGroups[id,code]" > "$F/orgUnit.json"
ls -la "$F"
