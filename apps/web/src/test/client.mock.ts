import { type Mock, vi } from "vitest"

type Endpoint = Mock<(input?: unknown) => Promise<unknown>>
const endpoints = new Map<string, Endpoint>()

/** The spy behind `api.<group>.<name>`: created on first use, resolving to undefined until a test says otherwise. */
export const endpoint = (group: string, name: string): Endpoint => {
  const key = `${group}.${name}`
  let spy = endpoints.get(key)
  if (!spy) {
    spy = vi.fn(async () => undefined)
    endpoints.set(key, spy)
  }
  return spy
}

/**
 * What stands in for `api/client` in a page test:
 * `vi.mock("../../api/client", async () => (await import("../../test/client.mock")).clientMock())`.
 * Every endpoint is a spy and `run` passes its promise straight through, so the real query hooks
 * run as they ship and a test asserts on `endpoint("loans", "delete")`.
 */
export const clientMock = () => ({
  api: new Proxy({}, { get: (_, group) => new Proxy({}, { get: (_, name) => endpoint(String(group), String(name)) }) }),
  run: (result: Promise<unknown>) => result,
  ApiError: class ApiError extends Error {}
})
