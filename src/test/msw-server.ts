import { setupServer } from 'msw/node'

/**
 * Shared MSW node server for the Vitest suite. Individual test files add
 * their own handlers via `server.use(...)`; this default export starts
 * with an empty handler list so unrelated tests don't leak mocked routes.
 */
export const server = setupServer()
