---
name: system-design-thinking
description: >
  Apply this skill whenever the user asks about system design, software architecture, trade-off analysis,
  designing for failure, modular code structure, microservices, scalability, layered architecture, debugging
  strategy, or engineering mindset. Also trigger when the user is designing a new feature, reviewing how
  components should communicate, naming variables or methods, structuring a codebase, or asking "how should
  I build X?" — even if they don't use the word "architecture." If the question is about how a system should
  be organized, how components should fail safely, or how code should be structured for maintainability,
  this skill applies. Use it proactively; don't wait for the user to say "system design."
---

# System Design and Systems Thinking

This skill covers two interlocked disciplines: **how to think** when designing systems, and **how to structure** those systems so they survive reality. Apply both together — the cognitive frameworks drive the architectural decisions, and the architecture exposes which mental models are missing.

---

## Part 1: Engineering Mindsets

### 1.1 Failure-First Thinking

**Default assumption: everything will break.** APIs go down, queues back up, disks fill, networks partition, third-party services change their response schemas without warning. The happy path is not a plan — it's a hope.

When designing any component, run this checklist before writing a line of code:

- What happens if this external dependency is slow (not down — *slow*)?
- What happens if this dependency returns a 200 with a malformed body?
- What happens if this runs twice (at-least-once delivery)?
- What happens at 10x expected load?
- What is the user experience if this fails silently?

**Practical patterns that implement failure-first thinking:**
- **Circuit breakers**: Stop calling a failing service; fail fast and recover gracefully.
- **Timeouts everywhere**: Every network call, every DB query. No exceptions.
- **Idempotency keys**: Make retries safe by design, not by luck.
- **Dead-letter queues**: Failed messages go somewhere observable, not into a void.
- **Graceful degradation**: Identify which features can run in a degraded mode vs. which ones must hard-fail.

Do not add these as an afterthought. A system that works perfectly under normal conditions and collapses at 2 AM on a Saturday is not a production system.

### 1.2 Trade-Off Thinking

There are no universally correct technology choices. Every decision trades one property for another. The job is to know *which* trade-offs matter for *this* specific context, not to find the optimal solution in the abstract.

**The canonical trade-off axes:**

| Axis | Option A | Option B |
|------|----------|----------|
| Consistency vs. Availability | CP systems (PostgreSQL, Zookeeper) | AP systems (Cassandra, DynamoDB) |
| Read performance vs. Write performance | Denormalize / cache aggressively | Normalize / single source of truth |
| Operational simplicity vs. Scalability | Monolith, managed services | Microservices, custom infra |
| Latency vs. Throughput | Eager computation, low queue depth | Batch processing, high queue depth |
| Flexibility vs. Structure | Schema-less (document stores) | Schema-enforced (relational, Avro, Protobuf) |

**How to make a trade-off decision:**
1. State what you are actually optimizing for in this system right now.
2. Identify which trade-off axis is relevant.
3. Choose, then document the reasoning — not just the outcome.
4. Revisit when constraints change. A correct decision at 1,000 users may be wrong at 1,000,000.

Never choose a technology because it is popular, modern, or used by a company 100x your size. Choose it because it fits your current constraints and your team can operate it.

### 1.3 Product Thinking

Code that works is not the same as code that should exist. Before building:

- **Who is the user?** Not the persona — the actual person in the actual situation. What emotional state are they in when they use this feature? Stressed? Browsing? In a hurry?
- **Why does this feature exist?** Trace the request back to the business outcome it serves.
- **Is there an existing path?** Can a small configuration change, a new query, or a UI adjustment handle 80% of the use case without new infrastructure?

If you cannot answer these, ask before coding. Shipping the wrong thing fast is slower than pausing to ask why.

### 1.4 Strategic Debugging

Debugging is hypothesis elimination, not guess-and-check. The goal is to shrink the problem space as fast as possible.

**The elimination approach:**
1. State the observable symptom precisely. ("Users report checkout fails" is not precise. "POST /orders returns 500 for users with >3 items in cart, added after 2024-01-01" is.)
2. List the components involved in the code path.
3. Identify the earliest point in the chain where you can inject an observation (log, metric, breakpoint, curl).
4. Form a binary question: "Is the failure happening before or after the payment service call?"
5. Answer it. Eliminate half the search space. Repeat.

**Anti-patterns to avoid:**
- Changing multiple things at once (you lose signal).
- Assuming the most recent deployment caused the issue without checking (it often did, but confirm).
- Debugging in production without a reproduction in a controlled environment.
- Reading code to understand behavior instead of running it and observing it.

### 1.5 Systems Thinking

A complex system is not the sum of its components — it is the sum of the *interactions* between its components. Design interactions as deliberately as you design components.

**Key principles:**

**Encapsulation of failure domains**: A component should fail in a way that does not propagate state corruption to its neighbors. Design explicit boundaries. If Service A fails, Service B should degrade, not crash.

**Minimize coupling**: High coupling means one change requires many changes. Measure coupling by asking: "If I rename this field, how many files do I have to touch?" The answer should be small.

**Explicit contracts**: The interface between two components (API contract, event schema, shared database table) is more important than either component's implementation. Treat it as a public API even when it's internal.

**Feedback loops**: Systems need observability — metrics, logs, traces — so they can be understood and corrected. A system with no feedback loops is a system that degrades silently.

---

## Part 2: Code Architecture and Modularity

### 2.1 The Five Properties of Maintainable Code

Every code change should preserve these:

1. **Readable** — A new team member can understand what a function does without running it.
2. **Modifiable** — Changing one thing does not require understanding everything.
3. **Debuggable** — When something goes wrong, you can locate it without guessing.
4. **Isolated** — A change in one module does not silently break another.
5. **Honest** — The code does what it says it does. No hidden side effects, no surprising global state mutations.

If a proposed change degrades any of these, it requires justification, not just working tests.

### 2.2 Naming: Ubiquitous Language

Variable and function names are the primary documentation of your codebase. Comments explain *why*; names explain *what*.

**Rules:**
- Use the exact terminology your business domain uses. If the product team calls them "trips," the codebase has `Trip`, not `Route` or `Journey` or `TravelRecord`.
- Encode intent, not type. `userList` tells you nothing useful. `activeSubscribersEligibleForUpgrade` tells you everything.
- Avoid abbreviations that are not universally obvious (`req`, `res`, `ctx` are fine; `usrDt` is not).
- Scope should shrink with name length. A loop variable can be `i`. A method-level variable should be descriptive. A module-level variable should be extremely explicit.

**Avoid:**
- `temp`, `data`, `info`, `stuff`, `helper`, `manager`, `util` — these are non-names.
- Names that lie: a function called `getUser` that also sends an email.

### 2.3 Method Design

A method should have one responsibility and should be fully self-describing from its signature.

**Rules for good methods:**
- The name is the spec. If you need a comment to explain what a method does, rename it first.
- Input → Output, no hidden dependencies. A method that reads from a global, modifies shared state, and returns a value has three jobs, not one.
- Methods should be independently testable without standing up the whole system.
- If a method is longer than fits on one screen, it is almost certainly doing too many things.

**Decomposition signal**: When you find yourself writing comments like `// Step 1:` and `// Step 2:`, those are method boundaries disguised as comments. Extract them.

### 2.4 Strict Layered Architecture

Spaghetti code is almost always a layering violation — logic that belongs in one layer has leaked into another.

**The standard layers and their single responsibilities:**

```
┌─────────────────────────────┐
│         Controller          │  ← HTTP in/out. Validates shape. Routes to service.
│    (Request / Response)     │    No business logic. No DB calls.
├─────────────────────────────┤
│          Service            │  ← Workflow orchestration. Calls domain + infra.
│         (Command)           │    No HTTP concerns. No raw SQL.
├─────────────────────────────┤
│          Domain             │  ← Business rules. Pure functions where possible.
│    (Core business logic)    │    No knowledge of HTTP, DB, or external services.
├─────────────────────────────┤
│       Infrastructure        │  ← DB, message queues, external APIs.
│   (Repository / Adapter)    │    Implements interfaces defined by Domain.
└─────────────────────────────┘
```

**Enforcement rules:**
- A Controller never contains an `if` that enforces business logic.
- A Domain entity never imports a database library.
- An Infrastructure adapter never returns a domain entity directly — it maps.
- If you're unsure which layer something belongs to, ask: "Would this change if I switched from REST to gRPC?" If yes, it's Controller. "Would this change if I switched from PostgreSQL to MongoDB?" If yes, it's Infrastructure.

### 2.5 DTO Boundaries and the No-Pass-Through Rule

DTOs (Data Transfer Objects) carry data across layer boundaries. They are not shared state.

**Naming by layer:**
- Controller layer: `CreateOrderRequest`, `CreateOrderResponse`
- Service/Application layer: `CreateOrderCommand`, `CreateOrderResult`
- Domain layer: `Order`, `OrderItem` (domain entities, not DTOs)
- Infrastructure layer: `OrderRow`, `OrderDocument` (DB/wire format)

**The no-pass-through rule**: A DTO from one layer must never be directly passed into another layer. It must be explicitly mapped. This is not boilerplate — it is the mechanism that allows each layer to change independently. When a Controller DTO leaks into the Domain, you've coupled your API contract to your business logic.

**Debugging value**: When a bug is reported, the layer-specific naming tells you immediately which boundary was crossed to produce the bad state.

---

## Part 3: Design Process Heuristics

### Ask These Before Any New Feature

1. **Why does this feature exist?** What is the user trying to do, and why can't they do it today?
2. **Can an existing component handle this?** Reuse with a new configuration, query, or minor extension is almost always cheaper than new infrastructure.
3. **What does failure look like?** Define it before you build, not after.
4. **Who owns this?** Code without a clear owner drifts.

### The CEO Mental Model

Visualize your system as an organization:
- **Microservices / major modules** = departments (they have a single clear mandate)
- **Files / classes** = people within departments (specialized, not generalists)
- **Methods / functions** = individual tasks those people perform
- **APIs / events** = memos and meetings between departments (explicit, documented, not assumed)

A good organization does not have people from Marketing doing Payroll tasks. A good codebase does not have Controller logic doing Domain enforcement.

### Designing for Change

The highest-leverage architectural question is: "What will change, and what must remain stable?"

- **Stable**: Core business rules, domain entities, public API contracts.
- **Likely to change**: External integrations, UI, infrastructure choices, third-party APIs.

Put interfaces between stable and unstable. Let the unstable side change without touching the stable side.

---

## Anti-Patterns Reference

| Anti-Pattern | What It Looks Like | Why It's Dangerous |
|---|---|---|
| God Object | One class that knows everything | All changes ripple through it |
| Shotgun Surgery | One change requires 15 file edits | High coupling; high change cost |
| Leaky Abstraction | DB schema exposed in API response | DB change = API break |
| Silent Failure | `catch(e) {}` with no logging | Bugs become invisible |
| Premature Optimization | Caching before profiling | Complexity without measured benefit |
| Distributed Monolith | Microservices that share a DB | Coupling without isolation benefit |
| Naming by Type | `userList`, `dataMap`, `infoObject` | No information about purpose |
| Happy Path Only | No error handling, no timeouts | Works in dev, fails in prod |

---

## Quick-Reference Checklist

**Before designing:**
- [ ] Can I state the failure modes before writing code?
- [ ] Do I know which trade-offs I'm making and why?
- [ ] Do I know why this feature should exist at all?

**Before committing:**
- [ ] Does every method name describe its complete behavior?
- [ ] Does any logic exist in the wrong layer?
- [ ] Is any DTO being passed across a layer boundary without transformation?
- [ ] Are all external calls covered with timeouts and error handling?
- [ ] Can I name what changes without breaking this, and what breaks it?

**When debugging:**
- [ ] Can I state the exact symptom with specific conditions?
- [ ] Have I formed a binary hypothesis before changing anything?
- [ ] Am I eliminating search space, or guessing?