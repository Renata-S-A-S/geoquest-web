import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { getGamingProfile, getLeaderboard } from '@/features/gamification/gamification-api'

/**
 * `apiClient`'s dev fallback baseURL (see `checkin-api.test.ts` for the same
 * note) — MSW must intercept that exact origin.
 */
const baseURL = 'http://localhost:5219'

const profilePayload = {
  explorerId: 'explorer-1',
  totalXP: 820,
  weeklyXP: 120,
  geoPointsBalance: 40,
  currentLevel: 'Traveler',
  currentStreak: 3,
  longestStreak: 8,
  lastActivityLocalDate: '2026-08-24',
  badges: [{ name: 'Primer paso', awardedAtUtc: '2026-08-20T00:00:00Z' }],
}

const leaderboardPayload = {
  weekStartUtc: '2026-08-24T00:00:00Z',
  top: [
    {
      rank: 1,
      explorerId: 'explorer-1',
      username: 'nachomed',
      avatarUrl: null,
      weeklyXP: 500,
    },
  ],
  me: {
    rank: 1,
    explorerId: 'explorer-1',
    username: 'nachomed',
    avatarUrl: null,
    weeklyXP: 500,
  },
}

describe('getGamingProfile', () => {
  it('parses a 200 GET /gaming/profile response', async () => {
    server.use(http.get(`${baseURL}/gaming/profile`, () => HttpResponse.json(profilePayload)))

    const profile = await getGamingProfile()

    expect(profile).toEqual(profilePayload)
  })

  it('surfaces a 404 as a rejected promise, not a parsed profile', async () => {
    server.use(http.get(`${baseURL}/gaming/profile`, () => new HttpResponse(null, { status: 404 })))

    await expect(getGamingProfile()).rejects.toMatchObject({ response: { status: 404 } })
  })
})

describe('getLeaderboard', () => {
  it('parses a 200 GET /gaming/leaderboard response', async () => {
    server.use(
      http.get(`${baseURL}/gaming/leaderboard`, () => HttpResponse.json(leaderboardPayload))
    )

    const leaderboard = await getLeaderboard()

    expect(leaderboard).toEqual(leaderboardPayload)
  })

  it('parses a response with an empty top list and me=null', async () => {
    const payload = { weekStartUtc: '2026-08-24T00:00:00Z', top: [], me: null }
    server.use(http.get(`${baseURL}/gaming/leaderboard`, () => HttpResponse.json(payload)))

    const leaderboard = await getLeaderboard()

    expect(leaderboard).toEqual(payload)
  })
})
