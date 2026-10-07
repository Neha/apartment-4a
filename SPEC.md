# Apartment 4A

A local control room for a software team of Cursor agents. The user assigns one task and does not name teammates. The server runs the lead, then the specialists that the task text implies, one writer at a time.

## Requirements

**Requirement 1: See the team**

*User story:* As the person running the team, I want every role visible with its current status, so that I can tell who is idle, working, or blocked.

Acceptance criteria:

1. THE app SHALL show Leonard, Sheldon, Penny, Howard, Raj, Amy, and Bernadette, each with a role.
2. THE app SHALL show a status for each agent of offline, idle, working, blocked, or done.
3. WHEN an agent is working, THE app SHALL show a short activity line on that agent in the room and in the roster.

**Requirement 2: Assign one task**

*User story:* As the person running the team, I want to type one task and hand it to the team, so that I do not have to start each agent by hand.

Acceptance criteria:

1. WHEN the user submits a non-empty task and Cursor credentials are available, THE app SHALL start Leonard on that task against the configured project folder.
2. WHEN a task is already running, THE app SHALL reject another assignment and keep the current task going.
3. IF Cursor credentials are missing, THEN THE app SHALL refuse to start a task and tell the user how to connect.
4. THE app SHALL persist tasks, runs, and messages so they are still there after a restart.

**Requirement 3: Route teammates from the task**

*User story:* As the person running the team, I want the task text to decide who works, so that I do not name agents in the prompt.

Acceptance criteria:

1. WHEN the task asks for a written note or page, THE app SHALL run Sheldon, then Penny, then Amy after Leonard, in that order.
2. WHEN the task is only a question, THE app SHALL run Leonard, then Penny.
3. WHEN the task names build, debugging, testing, implementation, product, or status work, THE app SHALL run the matching specialists, at most three, after Leonard. WHEN Penny is not already one of those specialists, THE app SHALL run her after them to explain the result. Bernadette runs when the task asks for code or to develop something.
4. THE app SHALL run only one writer at a time.
5. WHEN a specialist runs, THE app SHALL pass the original task and the notes from earlier agents.

**Requirement 4: Inspect the selected agent**

*User story:* As the person running the team, I want to select an agent and read their checklist, current thought, files, and the team thread, so that I can follow the work without opening each Cursor chat.

Acceptance criteria:

1. WHEN the user selects an agent, THE app SHALL show that agent’s run for the latest task.
2. WHEN a run streams assistant text, THE app SHALL update the current thought.
3. WHEN a run streams a tool call, THE app SHALL add or update a checklist row and, when a file path is present, list that file.
4. WHEN a run finishes, THE app SHALL add that agent’s summary to the team discussion.

**Requirement 5: Connect Cursor and choose the folder**

*User story:* As the person running the team, I want to connect my Cursor account and choose which folder agents edit, so that the team works in the right repository.

Acceptance criteria:

1. THE app SHALL treat `CURSOR_API_KEY` or a completed Cursor login as the credential.
2. WHEN the user saves a project folder, THE app SHALL use that folder as the local agent working directory for later tasks.
3. IF the folder does not exist, THEN THE app SHALL reject the save.
4. THE app SHALL keep the API key on the server and out of the page payload.

## Design

- **Control room UI** (requirements 1, 4). Three panes and a composer: roster, office, inspector. The office is a view of agent status. Selection is client state.
- **Store** (requirements 2, 4). A JSON file holds the project, per-agent Cursor ids and status, tasks, runs, and messages. Role prompts live in code and are merged at read time.
- **Orchestrator** (requirements 2, 3). `assignTask` starts Leonard, streams the run into the store, then runs the specialists chosen by `specialistsForTask`. A process-wide busy flag enforces one writer.
- **Cursor runtime** (requirements 2, 5). `@cursor/sdk` local runtime. First task for a role calls `Agent.create` and stores `agentId`. Later tasks call `Agent.resume`. The handle is disposed after each run. The model defaults to `composer-2.5`.
- **Account** (requirement 5). Integrations can start `Cursor.auth.login()`. State reports whether a key is configured, never the key itself.
- **Live updates** (requirements 1, 4). Mutations publish on an in-process hub. The page listens with server-sent events and refreshes the full state.

## Tasks

1. Scaffold the Next.js app, spec, and gitignore. Traces to the design as a whole.
2. Implement the store, roster, handoff parser, and stream-to-run folding, with unit tests. Traces to Store, Orchestrator, requirement 3 and 4.
3. Implement account login status and the orchestrator. Traces to Cursor runtime and Account.
4. Implement the HTTP routes for state, tasks, project settings, connect, and events. Traces to Live updates and requirement 5.
5. Implement the control-room interface. Traces to Control room UI.
6. Run unit tests, typecheck, and verify the interface in the browser. Traces to requirements 1 and 5.
