import { Effect, Stream } from 'effect'
import { ChildProcess } from 'effect/process'

// Argument arrays throughout; no shell interpolation or credential values in args.
export const docker = (args: string[], interactive = false) =>
    Effect.scoped(
        Effect.gen(function* () {
            const child = yield* ChildProcess.make('docker', args, {
                stdin: interactive ? 'inherit' : 'ignore',
                stdout: interactive ? 'inherit' : 'pipe',
                stderr: 'inherit',
            })
            const output = interactive
                ? ''
                : yield* Stream.mkString(Stream.decodeText(child.stdout))
            const code = yield* child.exitCode
            if (code !== 0)
                return yield* Effect.fail(
                    new Error(`docker ${args[0]} failed (exit ${code})`)
                )
            return output.trim()
        })
    )
