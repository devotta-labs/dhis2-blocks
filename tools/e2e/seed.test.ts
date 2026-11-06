import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    seedMetadata,
    seedUsers,
    seedLists,
    seedTracker,
    seedList,
    seedUser,
    invalidDate,
} from '../../e2e/fixtures/seed.ts'

test('seed user roles, groups, program and saved-list references are consistent', () => {
    const program = seedMetadata.programs[0]
    for (const user of seedUsers) {
        assert.ok(user.userRoles.length)
        for (const role of user.userRoles)
            assert.ok(seedMetadata.userRoles.some(({ id }) => id === role.id))
        for (const group of user.userGroups)
            assert.ok(seedMetadata.userGroups.some(({ id }) => id === group.id))
        assert.deepEqual(user.organisationUnits, program.organisationUnits)
    }
    for (const list of seedLists.lists) {
        assert.equal(list.id, list.data.id)
        assert.equal(list.data.program.id, program.id)
    }
    assert.equal(seedLists.sharing.id, seedList('E2E shared reader list').id)
    assert.deepEqual(
        seedUser('Reader').userGroups.map(({ id }) => id),
        seedLists.sharing.userGroupAccesses.map(({ id }) => id)
    )
    assert.deepEqual(seedUser('Outsider').userGroups, [])
    for (const stage of seedMetadata.programStages)
        assert.equal(stage.program.id, program.id)
})

test('invalid date corruption names one seeded entity and one unique SQL-match value', () => {
    const entity = seedTracker.trackedEntities.find(
        ({ trackedEntity }) => trackedEntity === invalidDate.trackedEntity
    )
    assert.ok(entity)
    const date = entity.attributes.find(
        ({ attribute }) => attribute === invalidDate.attribute
    )
    assert.ok(date)
    assert.notEqual(date.value, invalidDate.value)
    assert.ok(
        seedMetadata.trackedEntityAttributes.some(
            ({ id, valueType }) =>
                id === invalidDate.attribute && valueType === 'DATE'
        )
    )
    assert.equal(
        seedTracker.trackedEntities.filter(({ attributes }) =>
            attributes.some(
                ({ attribute, value }) =>
                    attribute === invalidDate.attribute && value === date.value
            )
        ).length,
        1
    )
})
