# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary in [SKILL.md](SKILL.md): **module**, **interface**, **seam**, **adapter**.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. Deepening may be straightforward: merge the modules and, when testing is authorized, check through the new interface directly. No adapter needed.

### 2. Local-substitutable

Dependencies that have local test stand-ins (PGLite for Postgres, in-memory filesystem). Deepen only when the stand-in fits the task and project. If tests are authorized, the deepened module can be checked with the stand-in. The seam is internal; no port at the module's external interface.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (microservices, internal APIs). When [seam discipline](#seam-discipline) justifies it, define a **port** (interface) at the seam. The deep module owns the logic; the transport is injected as an **adapter**. When test work is authorized, use an in-memory adapter. Production uses an HTTP/gRPC/queue adapter.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for tests if they are requested and authorized, so the logic sits in one deep module even though it's deployed across a network."*

### 4. True external (Mock)

Third-party services (Stripe, Twilio, etc.) you don't control. Keep the calls to the dependency in one place inside the module. The module takes it as an injected port only when variability under [seam discipline](#seam-discipline) applies; a mock adapter counts for that only when test work is requested and authorized.

## Seam discipline

- **One adapter means a hypothetical seam, unless observation or policy isolation applies. Two adapters means a real one.** Introduce a port only for a reason you can name in the current task:
  - **Variability.** Two adapters exist, or the task requires both. A test adapter counts only when test work is requested and authorized.
  - **Observation.** A check the task requests must sense behaviour at that point and cannot reach it through the module's interface. First ask whether the module is the wrong shape: wanting to test past the interface usually means it is.
  - **Policy isolation.** The dependency is external or volatile, and without the seam its types, errors or call sequence would spread through the module's logic.
- **If none of the three applies, call the dependency directly.** A single-adapter seam kept for a swap that might happen later is just indirection. Do not invent a second adapter to satisfy the rule.
- **Size the seam to its reason.** A seam justified by observation or policy isolation stays internal and as small as that need; it becomes part of the module's interface only when variability requires it.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them.

## Test design guidance

- Do not add, modify or delete tests unless the user explicitly requests test work. Do not run tests unless requested; follow the permission contract in `requirement-traceability`.
- When test work is authorized, prefer checking observable outcomes through the deepened module's interface. The **interface is the test surface**.
- Tests should describe behavior rather than internal state and remain useful through internal refactors. These principles guide authorized test work; they do not grant permission to change or run tests.
