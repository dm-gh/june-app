---
status: accepted
---

# The backend is built on Effect

June is a solo project whose purpose is partly to practise specific technologies, and Effect is the one the author most wants to learn. We use the Effect ecosystem end to end on the server: its HTTP server and API definitions, its Schema for validation, its SQL client for Postgres, and its Config and Layer system for wiring. A plain Node framework such as Fastify or Hono would be less code for an app this size; we chose Effect anyway because the learning value is the point, and because its typed errors and dependency layers keep a growing solo codebase navigable.

## Consequences

- Contributors must know Effect idioms; there is no "plain Node" escape hatch in the server.
- Validation, HTTP, and database access should all go through Effect modules rather than mixing in third-party equivalents.
