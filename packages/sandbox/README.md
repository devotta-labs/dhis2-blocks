# Coding sandbox

Each session starts with an **empty workspace**, internet access, pnpm and the
native fx terminal in Docker. Create an app and install published dependencies
as you normally would. The wrapper uses Effect 4's CLI and Node process helpers.

## Run

The host needs Node **22.19+**, pnpm **10.13.1** and running Docker Desktop.
From the repository:

```sh
pnpm install
pnpm sandbox start
pnpm sandbox list
pnpm sandbox attach <session>
pnpm sandbox stop <session>
pnpm sandbox remove <session>
```

`start` creates the container, prints its preview address and opens fx in your
terminal. Ask fx to create an app using pnpm and install Blocks from the public
registry, following the same published installation instructions as any other
consumer. The sandbox uses Docker's normal outbound internet access.

`detach` defaults to **false**: plain `pnpm sandbox start` opens fx.
Use `pnpm sandbox start --detach` to create a session without opening fx. For a
shell inside it:

```sh
docker exec -it --workdir /sandbox/app blocks-sandbox-<session> bash
```

For example, inside the sandbox you or fx can scaffold an app normally:

```sh
pnpm create vite@latest . --template react-ts --no-interactive
pnpm install
sandbox-preview pnpm dev --host 0.0.0.0 --port 5173
```

Choose your own app framework and install Blocks from its published registry
once the app has the necessary Tailwind and shadcn configuration. The wrapper
copies no app template, Blocks source, registry JSON, or repository files into
the workspace. shadcn is not preinstalled; use pnpm to obtain the published CLI.

## Preview and lifetime

The printed localhost address forwards to container port **5173**. It becomes
available after your app's dev server listens on **0.0.0.0:5173**. Normal hot
reload works through the same port.

`sandbox-preview <command> [args]` saves and starts the specified server command
from your current directory. Its output goes to `/sandbox/logs/dev.log`.
The server runs independently of fx; `/exit` leaves fx while the app keeps
running. Running the helper again replaces the server. `stop` stops the
container and retains its files. `attach` restarts it, restores a previously
configured preview command, and opens the latest saved fx conversation (or a new
conversation when no history exists). Docker may allocate a new localhost port
on restart; use the URL shown by `attach` or `list`.

Your local DHIS2 is reachable **from inside Docker** using
`http://host.docker.internal:<host-port>`. Configure your generated app's
server-side proxy and authentication normally. No DHIS2 login is required to
create a sandbox, and the wrapper copies no DHIS2 credentials or config into it.
Keep app secrets on the server, outside browser bundles and version control.

## fx credentials

Export `AI_GATEWAY_API_KEY` before `start` or `attach`, or use fx's native
account/API-key onboarding. Only the named API-key environment variable is
forwarded to fx, without its value appearing in command arguments or local
session metadata. Host agent logins, skills and configuration are not inherited;
no host home or Docker socket is mounted.

The native [fx v0.0.16 release](https://github.com/vercel-labs/fx/releases/tag/v0.0.16)
was verified as the latest stable release on 2026-11-09. The Dockerfile checks its
architecture-specific SHA-256 before installing it. `launchFx` in `src/sessions.ts`
is the small harness seam; this uses the native CLI rather than libfx or the
embedded adapter. See the [fx manual](https://fx.sh/docs) and `fx --help` for its
helpers. Effect and its Node platform are pinned to
[4.1.2](https://github.com/Effect-TS/effect/releases/tag/effect%404.1.2); the CLI
and process APIs are marked unstable upstream.

## Storage and cleanup

Local metadata lives in ignored `.blocks-sandboxes/<session>/`. A separate named
volume `blocks-sandbox-<session>-data` persists:

- `/sandbox/app`: initially empty; your files and installed dependencies.
- `/sandbox/home`: fx history, settings, login and pnpm cache.
- `/sandbox/logs/dev.log`: output from your configured preview server.
- `/sandbox/preview.json`: the explicit server command used after a restart.

Inspect or export a session using:

```sh
docker logs blocks-sandbox-<session>
docker exec blocks-sandbox-<session> cat /sandbox/logs/dev.log
docker cp blocks-sandbox-<session>:/sandbox/app ./my-app
```

`remove` explicitly deletes the session's container, volume, files, fx login and
metadata without an extra confirmation prompt. The shared Docker image stays
cached. Existing sessions keep their original image; start a new one to use a
changed sandbox runtime.

## Verification

```sh
pnpm --filter @dhis2-blocks/sandbox typecheck
pnpm lint
pnpm dead-code:audit
```

Runtime verification needs Docker: confirm a new workspace is empty, scaffold an
app and fetch packages from the internet, launch the preview, edit a file, then
stop/attach and verify the app is restored. Use a separate disposable session to
test removal. Model edits require connecting a provider in fx.
