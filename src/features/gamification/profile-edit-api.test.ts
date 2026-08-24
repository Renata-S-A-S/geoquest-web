import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import {
  buildProfilePatchForm,
  mapProfilePatchError,
  updateExplorerProfile,
} from '@/features/gamification/profile-edit-api'
import type { ProfilePatchInput } from '@/shared/schemas/gamification'

const baseURL = 'http://localhost:5219'

function fields(form: FormData): string[] {
  return Array.from(form.keys())
}

describe('buildProfilePatchForm', () => {
  it('appends username when provided', () => {
    const form = buildProfilePatchForm({ username: 'nachomed', avatarChange: { kind: 'none' } })
    expect(form.get('username')).toBe('nachomed')
  })

  it('omits username entirely when not provided', () => {
    const form = buildProfilePatchForm({ avatarChange: { kind: 'none' } })
    expect(fields(form)).not.toContain('username')
  })

  it('appends one repeated interests entry per value, in order', () => {
    const form = buildProfilePatchForm({
      interests: ['Naturaleza', 'Aventura'],
      avatarChange: { kind: 'none' },
    })
    expect(form.getAll('interests')).toEqual(['Naturaleza', 'Aventura'])
  })

  it('omits interests entirely when not provided', () => {
    const form = buildProfilePatchForm({ avatarChange: { kind: 'none' } })
    expect(fields(form)).not.toContain('interests')
  })

  it('kind=none appends neither avatar nor removeAvatar', () => {
    const form = buildProfilePatchForm({ avatarChange: { kind: 'none' } })
    expect(fields(form)).not.toContain('avatar')
    expect(fields(form)).not.toContain('removeAvatar')
  })

  it('kind=replace appends "avatar" (a file) and NOT "removeAvatar" — the XOR guardrail', () => {
    const file = new File(['fake-jpeg-bytes'], 'avatar.jpg', { type: 'image/jpeg' })
    const form = buildProfilePatchForm({ avatarChange: { kind: 'replace', file } })
    expect(form.get('avatar')).toBe(file)
    expect(fields(form)).not.toContain('removeAvatar')
  })

  it('kind=remove appends "removeAvatar"="true" and NOT a file — the XOR guardrail', () => {
    const form = buildProfilePatchForm({ avatarChange: { kind: 'remove' } })
    expect(form.get('removeAvatar')).toBe('true')
    expect(fields(form)).not.toContain('avatar')
  })
})

describe('updateExplorerProfile', () => {
  it('PATCHes /explorers/me with the built multipart form and parses the response', async () => {
    let receivedFieldNames: string[] = []
    server.use(
      http.patch(`${baseURL}/explorers/me`, async ({ request }) => {
        const form = await request.formData()
        receivedFieldNames = Array.from(form.keys())
        return HttpResponse.json({
          explorerId: 'explorer-1',
          username: 'nachomed',
          avatarUrl: null,
          interests: ['Naturaleza'],
          usernameChangedAt: '2026-08-24T00:00:00Z',
        })
      })
    )

    const input: ProfilePatchInput = {
      username: 'nachomed',
      interests: ['Naturaleza'],
      avatarChange: { kind: 'none' },
    }
    const result = await updateExplorerProfile(input)

    expect(receivedFieldNames.sort()).toEqual(['interests', 'username'].sort())
    expect(result.username).toBe('nachomed')
  })
})

describe('mapProfilePatchError', () => {
  async function captureError(input: ProfilePatchInput) {
    try {
      await updateExplorerProfile(input)
      throw new Error('expected updateExplorerProfile to reject, but it resolved')
    } catch (error) {
      return error
    }
  }

  const noopInput: ProfilePatchInput = { avatarChange: { kind: 'none' } }

  it.each([
    'Validation.Failed',
    'ExplorerProfile.NotFound',
    'ExplorerProfile.DuplicateUsername',
    'Explorer.InvalidUsernameFormat',
    'Explorer.ProfaneUsername',
    'Explorer.UsernameChangeCooldownActive',
    'Explorer.InvalidInterestsCount',
    'AvatarUpload.TooLarge',
  ] as const)(
    'maps a 400 problem+json title=%s to that code, using the server detail',
    async (code) => {
      server.use(
        http.patch(`${baseURL}/explorers/me`, () =>
          HttpResponse.json({ title: code, detail: `detail for ${code}` }, { status: 400 })
        )
      )

      const error = await captureError(noopInput)

      expect(mapProfilePatchError(error)).toEqual({ code, message: `detail for ${code}` })
    }
  )

  it('falls back to Unknown for an unrecognized title', async () => {
    server.use(
      http.patch(`${baseURL}/explorers/me`, () =>
        HttpResponse.json({ title: 'Something.Else', detail: 'huh' }, { status: 400 })
      )
    )

    const error = await captureError(noopInput)

    expect(mapProfilePatchError(error)).toEqual({ code: 'Unknown', message: 'huh' })
  })

  it('returns a network-error message when there is no response', async () => {
    server.use(http.patch(`${baseURL}/explorers/me`, () => HttpResponse.error()))

    const error = await captureError(noopInput)

    expect(mapProfilePatchError(error)).toEqual({
      code: 'Unknown',
      message: 'No pudimos conectar con el servidor. Intentá de nuevo.',
    })
  })

  it('returns the same non-axios fallback message for an unrelated error', () => {
    expect(mapProfilePatchError(new Error('boom'))).toEqual({
      code: 'Unknown',
      message: 'No pudimos guardar los cambios. Intentá de nuevo en unos minutos.',
    })
  })
})
