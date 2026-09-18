import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { requestAccountDeletion } from '@/features/settings/account-deletion-api'

const baseURL = TEST_API_BASE_URL

describe('requestAccountDeletion', () => {
  it('DELETEs /explorers/me and resolves on a 204 No Content', async () => {
    let requestCount = 0
    server.use(
      http.delete(`${baseURL}/explorers/me`, () => {
        requestCount += 1
        return new HttpResponse(null, { status: 204 })
      })
    )

    await expect(requestAccountDeletion()).resolves.toBeUndefined()
    expect(requestCount).toBe(1)
  })

  it('resolves again when the explorer is already PendingDeletion — the backend repeats the 204 as an idempotent no-op', async () => {
    // The domain method preserves the original `DeletionRequestedAtUtc`, so a
    // second request neither fails nor restarts the grace window: it is another
    // 204 and the caller must treat it exactly like the first one.
    server.use(
      http.delete(`${baseURL}/explorers/me`, () => new HttpResponse(null, { status: 204 }))
    )

    await expect(requestAccountDeletion()).resolves.toBeUndefined()
    await expect(requestAccountDeletion()).resolves.toBeUndefined()
  })

  it('rejects with the 409 response when the account is already fully deleted, without crashing the caller', async () => {
    server.use(
      http.delete(`${baseURL}/explorers/me`, () =>
        HttpResponse.json(
          { title: 'Explorer.AlreadyDeleted', status: 409 },
          { status: 409, headers: { 'content-type': 'application/problem+json' } }
        )
      )
    )

    await expect(requestAccountDeletion()).rejects.toMatchObject({ response: { status: 409 } })
  })
})
