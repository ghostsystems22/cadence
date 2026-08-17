# Cadence — Militarized Operating System

## Intent
Cadence is the human task-management source of truth. The **militarized / theatrical layer** turns execution into a clear command experience: operations, missions, briefs, resources, logs, and controlled side quests.

This is a behavioral interface, not a productivity game. Every mechanic must either clarify the next action, protect capacity, create a useful commitment, or preserve an auditable record.

## Core roles

| Role | Responsibility |
|---|---|
| **Gabriel** | Accepts, reprioritizes, executes, and closes missions. |
| **Cadence** | Canonical task, resource, schedule, and event record. |
| **JARVIS** | Reads operational state, drafts briefs, proposes mission plans, logs execution events, and flags conflicts. JARVIS does not silently create external commitments. |
| **Helios / delivery agents** | Produce scoped outputs; report status back through Cadence/JARVIS handoffs. |

`JARVIS Access` means a visible, auditable command surface and agent identity—not another human login wall.

## The command model

```text
Projects / objectives
        ↓
Tasks + capacity + deadlines              ← Cadence source of truth
        ↓
Daily Operation (today's ordered plan)
        ↓
Mission packs / pre-task briefs / reminders
        ↓
Execution events + time/resource updates
        ↓
After-action record → next daily operation
```

## Data model

### Existing task core
- Title, project/phase, status, priority
- Due date and hard deadline
- Estimated time and actual time
- `Time Allowed` (adjusted by the capacity circle / dial)
- Scheduled or pinned day
- Dependencies and child tasks

### Additive mission metadata
| Field | Purpose |
|---|---|
| **Front** | `Business Execution`, `Technical`, `Delivery`, `Body`, `Personal`, `Admin` |
| **Mission Code** | Short human-readable identifier, e.g. `SIEGE-014` |
| **Mission Class** | `Primary`, `Support`, `Side Quest`, `Recovery`, `Incident` |
| **Theatre** | Visual/narrative treatment: `Black Ops`, `Hacker`, `Field`, `Command` |
| **Definition of Done** | Concrete finish condition; no vague “work on” states |
| **Brief Source** | Links, references, client context, evidence, prior artifacts |
| **Resource Cost** | Time allowed plus energy/cognitive demand |
| **JARVIS Status** | `Not assessed`, `Briefed`, `In progress`, `Awaiting review`, `Blocked`, `Closed` |

### Operational records
- **Daily Operations** — date, commander intent, available capacity, main effort, tasks ordered for the day, risk flags, completion state.
- **Mission Briefs** — generated document snapshot tied to a task and date; this is immutable after briefing, so later changes remain auditable.
- **Operational Events** — timestamped changes: task created, time budget altered, status changed, briefing sent, mission accepted/deferred/closed, JARVIS proposal accepted/rejected.
- **Side Quest Pool** — small, bounded optional missions with an expiry, estimated cost, and benefit. They cannot replace a Primary mission.

## Interface surfaces

### 1. Command Dashboard
The Cadence home screen answers only:
- **What is today’s main effort?**
- **What is running, blocked, or overdue?**
- **How much time/capacity remains?**
- **What requires a human decision?**
- **What has JARVIS proposed?**

Sections:
- **Daily Operation** — main effort, ordered missions, capacity dial
- **Command Feed** — auditable JARVIS proposals and system events
- **Active Fronts** — Business, Technical, Delivery, Body
- **Alerts** — hard deadlines, blocked work, conflicting capacity
- **Mission Launch** — opens the mission pack for the selected task

### 2. Task Manager / resource command
The existing circle/dial is the authoritative capacity control:
- changing the dial changes `Time Allowed` / available daily capacity;
- Cadence recomputes what fits, what spills, and what becomes at risk;
- it never silently hides displaced work;
- all material time-budget edits create an Operational Event.

### 3. Daily Mission Brief
Generated once the day is committed, then readable in Cadence and by JARVIS.

**Style:** black-ops document, precise and cinematic; narrative only where it clarifies the action.

**Required sections:**
1. `SITREP` — active fronts, capacity, key constraints
2. `COMMANDER'S INTENT` — the single result that makes the day a win
3. `PRIMARY MISSIONS` — ordered tasks, time allowed, definition of done
4. `THREATS / BLOCKERS` — dependencies, risks, missing decisions
5. `RULES OF ENGAGEMENT` — what is explicitly out of scope today
6. `EXTRACTION` — shutdown and evidence required to close the operation

### 4. Pre-task brief and reminders
Before an important task, Cadence can issue a compact brief—not a generic notification:
- objective and definition of done
- time allowed and start trigger
- source material / links
- expected artifact
- known threat or blocker
- one recommended first action

Delivery starts in-app. Telegram/reminder delivery is a later integration and must use the same Mission Brief record, not an untracked second copy.

### 5. Spontaneous Missions / side quests
A controlled activation tool, not a random distraction generator.

Rules:
- only generated from the Side Quest Pool or a real operational gap;
- must have a `≤30 minute` time cost by default;
- must expire the same day;
- cannot displace a Primary mission or hard deadline;
- is marked `Accepted`, `Declined`, `Expired`, or `Closed` for learning;
- JARVIS may propose; Gabriel accepts.

### 6. ADHD Mission Generator
A task-specific launch pack for activation friction.

Input:
- selected Cadence task
- Front + Theatre
- time allowed
- source links/reference material
- difficulty/energy state

Output:
- mission name and concise narrative frame
- exact completion condition
- first 120 seconds of action
- timed phases / checkpoints
- visual direction board (image references or generated visual assets)
- appropriate theme: **Hacker** for technical work; **Black Ops / military command** for business and daily execution
- evidence required at extraction

The generator creates a mission pack. It does **not** create new work, change deadlines, or inflate scope.

## Visual universe

| Theatre | Use | Direction |
|---|---|---|
| **Command** | dashboard / planning | premium tactical control room; dark, calm, legible |
| **Black Ops** | business execution / important daily work | classified-operation document, sparse red/amber alerts |
| **Hacker** | technical implementation | terminal intelligence, dark green/cyan signal accents |
| **Field** | physical / personal execution | direct, physical, minimal narrative |

Visual treatment never overrides legibility. The primary dashboard remains a task manager first.

## Build order — vertical slices

### Slice 1 — Cadence command core
- Add Front, Mission Class, Theatre, Definition of Done, Time Allowed, and Operational Events.
- Extend the existing daily capacity dial with visible displacement/risk feedback.
- Add a minimal Command Dashboard view.

**Proof:** change a task’s time allowance; Cadence logs it, recalculates the day, and displays at-risk work.

### Slice 2 — Daily Operation + brief
- Generate a Daily Operation from today’s committed Cadence tasks.
- Store an immutable Mission Brief record.
- Render the brief in-app in black-ops document form.

**Proof:** one real day can be committed, briefed, executed, and closed with linked evidence.

### Slice 3 — JARVIS command access
- Add JARVIS command feed, proposals, and auditable accepted/rejected actions.
- JARVIS reads from Cadence and proposes; it does not silently alter priorities or create external commitments.

**Proof:** JARVIS proposes a valid re-ordering or blocker resolution; Gabriel accepts/rejects; the event is logged.

### Slice 4 — mission generator + side quests
- Generate a mission pack from a real task.
- Add bounded side-quest proposals and expiry.

**Proof:** launch one technical and one business mission pack; no primary task is displaced.

### Slice 5 — reminders and system linkage
- Trigger pre-task brief reminders from the Daily Operation.
- Connect approved Cadence task states to the wider JARVIS / Helios operating system through explicit handoffs.

**Proof:** a real task moves Cadence → agent handoff → result → Cadence event history without duplicate source-of-truth records.

## Non-negotiables
- Cadence remains the source of truth for tasks and execution records.
- No duplicate task system inside JARVIS, Telegram, Helios, or Notion.
- All agent proposals and material changes are logged.
- No “gamification” that creates work without operational value.
- No silent external communications or publishing.
- The command layer must work even when AI integrations are unavailable.
