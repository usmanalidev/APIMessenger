import express from 'express'
import cors from 'cors'
import path from 'path'
import multer from 'multer'
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
import {
  detectImportKind,
  convertOpenApi,
  convertPostmanCollection,
} from './importers.js'
import { PATHS } from './paths.js'

const app = express()
const PORT = process.env.PORT || 3847
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 },
})

app.use(cors())
app.use(express.json({ limit: '64mb' }))
app.use(express.urlencoded({ extended: true, limit: '64mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'B Postman', dataPath: PATHS.data })
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

async function importDocument(json) {
  const kind = detectImportKind(json)
  let converted

  if (kind === 'postman') {
    converted = convertPostmanCollection(json)
  } else if (kind === 'openapi') {
    converted = convertOpenApi(json)
  } else if (kind === 'native') {
    converted = {
      collection: {
        name: json.name,
        description: json.description,
        items: json.items,
      },
      environment: null,
    }
  } else {
    const err = new Error(
      'Unrecognized format. Import a Postman collection, OpenAPI/Swagger JSON, or B Postman file.'
    )
    err.status = 400
    throw err
  }

  const saved = await createCollection(converted.collection)
  let environment = null
  if (converted.environment) {
    environment = await createEnvironment(converted.environment)
    await saveSettings({ activeEnvironmentId: environment.id })
  }

  return { collection: saved, environment, kind }
}

app.post('/api/import', async (req, res) => {
  try {
    res.status(201).json(await importDocument(req.body))
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Import failed' })
  }
})

app.post('/api/import/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    const text = req.file.buffer.toString('utf8')
    const json = JSON.parse(text)
    res.status(201).json(await importDocument(json))
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON file' })
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Max size is 64MB.' })
    }
    res.status(err.status || 400).json({ error: err.message || 'Import failed' })
  }
})

app.post('/api/import/postman', async (req, res) => {
  try {
    const converted = convertPostmanCollection(req.body)
    const saved = await createCollection(converted.collection)
    let environment = null
    if (converted.environment) {
      environment = await createEnvironment(converted.environment)
      await saveSettings({ activeEnvironmentId: environment.id })
    }
    res.status(201).json({ ...saved, environment })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid Postman collection' })
  }
})

app.post('/api/import/openapi', async (req, res) => {
  try {
    const converted = convertOpenApi(req.body)
    const saved = await createCollection(converted.collection)
    const environment = await createEnvironment(converted.environment)
    await saveSettings({ activeEnvironmentId: environment.id })
    res.status(201).json({ collection: saved, environment })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid OpenAPI document' })
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

await initStorage()
await seedIfEmpty()

app.listen(PORT, () => {
  console.log(`B Postman server → http://localhost:${PORT}`)
  console.log(`Data folder           → ${PATHS.data}`)
})
