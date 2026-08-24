import axios from 'axios'
import i18next from 'i18next'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { installLocaleInterceptor } from './locale-interceptor'

const baseURL = 'http://test.local'

function createClient() {
  const client = axios.create({ baseURL })
  installLocaleInterceptor(client)
  return client
}

describe('installLocaleInterceptor', () => {
  it.each(['/resource', '/auth/login', '/auth/refresh'])(
    'attaches Accept-Language to %s — unlike the auth interceptor, this one has no skip list',
    async (path) => {
      server.use(
        http.post(`${baseURL}${path}`, ({ request }) =>
          HttpResponse.json({ acceptLanguage: request.headers.get('accept-language') })
        ),
        http.get(`${baseURL}${path}`, ({ request }) =>
          HttpResponse.json({ acceptLanguage: request.headers.get('accept-language') })
        )
      )

      const client = createClient()
      const { data } = path === '/resource' ? await client.get(path) : await client.post(path, {})

      expect(data.acceptLanguage).toBe('es-CO')
    }
  )

  it('flips the header value from es-CO to en-US after the active language changes', async () => {
    server.use(
      http.get(`${baseURL}/resource`, ({ request }) =>
        HttpResponse.json({ acceptLanguage: request.headers.get('accept-language') })
      )
    )

    await i18next.changeLanguage('en')
    const client = createClient()
    const { data } = await client.get('/resource')

    expect(data.acceptLanguage).toBe('en-US')

    await i18next.changeLanguage('es')
  })
})
