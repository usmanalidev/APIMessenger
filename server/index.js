import express from 'express'
import cors from 'cors'
import path from 'path'
import {
  initStorage,
  seedIfEmpty,
  listCollections,
  getCollection,
  createCollection,
  saveCollection,
  deleteCollection,
  listEnvironments,
  getEnvironment,
  createEnvironment,
  saveEnvironment,
  deleteEnvironment,
  getHistory,
  addHistoryEntry,
  clearHistory,
  getSettings,
  saveSettings,
} from './storage.js'
import { executeRequest } from './proxy.js'
import { PATHS } from './paths.js'

const app = express()
const PORT = process.env.PORT || 3847

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'API Messenger', dataPath: PATHS.data })
})

app.get('/api/settings', async (_req, res) => {
  try {
    res.json(await getSettings())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/settings', async (req, res) => {
  try {
    res.json(await saveSettings(req.body || {}))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/collections', async (_req, res) => {
  try {
    res.json(await listCollections())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/collections/:id', async (req, res) => {
  try {
    const data = await getCollection(req.params.id)
    res.json(data)
  } catch (err) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.message })
  }
})

app.post('/api/collections', async (req, res) => {
  try {
    res.status(201).json(await createCollection(req.body || {}))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/collections/:id', async (req, res) => {
  try {
    res.json(await saveCollection(req.params.id, req.body || {}))
  } catch (err) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.message })
  }
})

app.delete('/api/collections/:id', async (req, res) => {
  try {
    res.json(await deleteCollection(req.params.id))
  } catch (err) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.message })
  }
})

app.get('/api/environments', async (_req, res) => {
  try {
    res.json(await listEnvironments())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/environments/:id', async (req, res) => {
  try {
    res.json(await getEnvironment(req.params.id))
  } catch (err) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.message })
  }
})

app.post('/api/environments', async (req, res) => {
  try {
    res.status(201).json(await createEnvironment(req.body || {}))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/environments/:id', async (req, res) => {
  try {
    res.json(await saveEnvironment(req.params.id, req.body || {}))
  } catch (err) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.message })
  }
})

app.delete('/api/environments/:id', async (req, res) => {
  try {
    res.json(await deleteEnvironment(req.params.id))
  } catch (err) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.message })
  }
})

app.get('/api/history', async (_req, res) => {
  try {
    res.json(await getHistory())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/history', async (_req, res) => {
  try {
    res.json(await clearHistory())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/proxy', async (req, res) => {
  try {
    const result = await executeRequest(req.body || {})
    if (!result.error) {
      await addHistoryEntry({
        method: result.method,
        url: result.url,
        status: result.status,
        duration: result.duration,
        size: result.size,
        name: req.body?.name || '',
        requestSnapshot: {
          method: req.body?.method,
          url: req.body?.url,
          params: req.body?.params,
          headers: req.body?.headers,
          auth: req.body?.auth,
          body: req.body?.body,
        },
      })
    }
    res.json(result)
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.post('/api/import/postman', async (req, res) => {
  try {
    const collection = convertPostmanCollection(req.body)
    const saved = await createCollection(collection)
    res.status(201).json(saved)
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid Postman collection' })
  }
})

const distPath = path.join(PATHS.root, 'dist')
app.use(express.static(distPath))
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next()
  })
})

function convertPostmanCollection(pm) {
  if (!pm || !pm.info) throw new Error('Missing Postman collection info')

  const mapItem = (item) => {
    if (item.item) {
      return {
        id: cryptoRandom(),
        type: 'folder',
        name: item.name || 'Folder',
        children: item.item.map(mapItem),
      }
    }

    const req = item.request || {}
    const url = typeof req.url === 'string' ? req.url : req.url?.raw || ''
    const method = (req.method || 'GET').toUpperCase()
    const headers = (req.header || []).map((h) => ({
      id: cryptoRandom(),
      key: h.key || '',
      value: h.value || '',
      enabled: !h.disabled,
    }))

    let body = { mode: 'none', raw: '', rawType: 'json', formData: [], urlencoded: [] }
    if (req.body) {
      if (req.body.mode === 'raw') {
        body = {
          mode: 'raw',
          raw: req.body.raw || '',
          rawType: req.body.options?.raw?.language || 'json',
          formData: [],
          urlencoded: [],
        }
      } else if (req.body.mode === 'urlencoded') {
        body = {
          mode: 'urlencoded',
          raw: '',
          rawType: 'json',
          formData: [],
          urlencoded: (req.body.urlencoded || []).map((r) => ({
            id: cryptoRandom(),
            key: r.key || '',
            value: r.value || '',
            enabled: !r.disabled,
          })),
        }
      } else if (req.body.mode === 'formdata') {
        body = {
          mode: 'formdata',
          raw: '',
          rawType: 'json',
          formData: (req.body.formdata || []).map((r) => ({
            id: cryptoRandom(),
            key: r.key || '',
            value: r.value || '',
            enabled: !r.disabled,
          })),
          urlencoded: [],
        }
      }
    }

    let auth = { type: 'none' }
    const a = req.auth || pm.auth
    if (a?.type === 'bearer') {
      auth = { type: 'bearer', token: a.bearer?.find?.((x) => x.key === 'token')?.value || a.bearer?.[0]?.value || '' }
    } else if (a?.type === 'basic') {
      auth = {
        type: 'basic',
        username: a.basic?.find?.((x) => x.key === 'username')?.value || '',
        password: a.basic?.find?.((x) => x.key === 'password')?.value || '',
      }
    }

    return {
      id: cryptoRandom(),
      type: 'request',
      name: item.name || 'Request',
      method,
      url,
      params: [],
      headers,
      auth,
      body,
    }
  }

  return {
    name: pm.info.name || 'Imported Collection',
    description: pm.info.description || 'Imported from Postman',
    items: (pm.item || []).map(mapItem),
  }
}

function cryptoRandom() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

await initStorage()
await seedIfEmpty()

app.listen(PORT, () => {
  console.log(`API Messenger server → http://localhost:${PORT}`)
  console.log(`Data folder           → ${PATHS.data}`)
})
