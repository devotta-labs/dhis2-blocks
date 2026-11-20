import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { Console, Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import * as sessions from './sessions.ts'

const session = Argument.String('session')
const start = Command.make(
    'start',
    {
        detach: Flag.Boolean('detach').pipe(
            Flag.withDefault(false),
            Flag.withDescription('Create the sandbox without opening fx')
        ),
    },
    ({ detach }) => sessions.start(detach)
)
const cli = Command.make('blocks-sandbox').pipe(
    Command.withDescription(
        'Empty Docker workspaces with pnpm, internet access and native fx'
    ),
    Command.withSubcommands([
        start,
        Command.make('list', {}, () => sessions.list),
        Command.make('attach', { session }, ({ session }) =>
            sessions.attach(session)
        ),
        Command.make('stop', { session }, ({ session }) =>
            sessions.stop(session)
        ),
        Command.make('remove', { session }, ({ session }) =>
            sessions.remove(session)
        ),
    ])
)

Command.run(cli, { version: '0.0.0' }).pipe(
    Effect.provide(NodeServices.layer),
    Effect.catch((error) =>
        Effect.gen(function* () {
            yield* Console.error(
                error instanceof Error ? error.message : String(error)
            )
            process.exitCode = 1
        })
    ),
    NodeRuntime.runMain
)
