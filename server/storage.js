import fs from 'fs/promises'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { PATHS } from './paths.js'

async function ensureDirs() {
  await fs.mkdir(PATHS.collections, { recursive: true })
  await fs.mkdir(PATHS.environments, { recursive: true })

  try {
    await fs.access(PATHS.history)
  } catch {
    await atomicWrite(PATHS.history, [])
  }

  try {
    await fs.access(PATHS.settings)
  } catch {
    await atomicWrite(PATHS.settings, {
      activeEnvironmentId: null,
      dataPath: PATHS.data,
    })
  }
}

async function atomicWrite(filePath, data) {
  const tmp = `${filePath}.${process.pid}.tmp`
  const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  await fs.writeFile(tmp, payload, 'utf8')
  await fs.rename(tmp, filePath)
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== null) return fallback
    throw err
  }
}

function collectionPath(id) {
  return path.join(PATHS.collections, `${id}.json`)
}

function environmentPath(id) {
  return path.join(PATHS.environments, `${id}.json`)
}

export async function initStorage() {
  await ensureDirs()
}

export async function listCollections() {
  await ensureDirs()
  const files = await fs.readdir(PATHS.collections)
  const collections = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const data = await readJson(path.join(PATHS.collections, file))
      collections.push({
        id: data.id,
        name: data.name,
        description: data.description || '',
        updatedAt: data.updatedAt,
        createdAt: data.createdAt,
        itemCount: countRequests(data.items || []),
      })
    } catch {
      // skip corrupt files
    }
  }

  return collections.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

function countRequests(items) {
  let n = 0
  for (const item of items) {
    if (item.type === 'request') n += 1
    if (item.type === 'folder' && item.children) n += countRequests(item.children)
  }
  return n
}

export async function getCollection(id) {
  return readJson(collectionPath(id))
}

export async function createCollection({ name, description = '', items = [] }) {
  const now = new Date().toISOString()
  const collection = {
    id: uuid(),
    schemaVersion: 1,
    name: name || 'Untitled Collection',
    description,
    createdAt: now,
    updatedAt: now,
    items,
  }
  await atomicWrite(collectionPath(collection.id), collection)
  return collection
}

export async function saveCollection(id, data) {
  const existing = await getCollection(id)
  const updated = {
    ...existing,
    ...data,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    schemaVersion: existing.schemaVersion || 1,
  }
  await atomicWrite(collectionPath(id), updated)
  return updated
}

export async function deleteCollection(id) {
  await fs.unlink(collectionPath(id))
  return { ok: true }
}

export async function listEnvironments() {
  await ensureDirs()
  const files = await fs.readdir(PATHS.environments)
  const envs = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const data = await readJson(path.join(PATHS.environments, file))
      envs.push({
        id: data.id,
        name: data.name,
        updatedAt: data.updatedAt,
        variableCount: (data.variables || []).length,
      })
    } catch {
      // skip
    }
  }

  return envs.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getEnvironment(id) {
  return readJson(environmentPath(id))
}

export async function createEnvironment({ name, variables = [] }) {
  const now = new Date().toISOString()
  const env = {
    id: uuid(),
    schemaVersion: 1,
    name: name || 'Untitled Environment',
    variables,
    createdAt: now,
    updatedAt: now,
  }
  await atomicWrite(environmentPath(env.id), env)
  return env
}

export async function saveEnvironment(id, data) {
  const existing = await getEnvironment(id)
  const updated = {
    ...existing,
    ...data,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  }
  await atomicWrite(environmentPath(id), updated)
  return updated
}

export async function deleteEnvironment(id) {
  await fs.unlink(environmentPath(id))
  return { ok: true }
}

export async function getHistory() {
  return readJson(PATHS.history, [])
}

export async function addHistoryEntry(entry) {
  const history = await getHistory()
  const item = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    ...entry,
  }
  history.unshift(item)
  const trimmed = history.slice(0, 200)
  await atomicWrite(PATHS.history, trimmed)
  return item
}

export async function clearHistory() {
  await atomicWrite(PATHS.history, [])
  return { ok: true }
}

export async function getSettings() {
  return readJson(PATHS.settings, {
    activeEnvironmentId: null,
    dataPath: PATHS.data,
  })
}

export async function saveSettings(data) {
  const existing = await getSettings()
  const updated = { ...existing, ...data }
  await atomicWrite(PATHS.settings, updated)
  return updated
}

export async function seedIfEmpty() {
  const collections = await listCollections()
  const envs = await listEnvironments()

  if (collections.length === 0) {
    await createCollection({
      name: 'Getting Started',
      description: 'Sample requests to explore API Messenger',
      items: [
        {
          id: uuid(),
          type: 'folder',
          name: 'Examples',
          children: [
            {
              id: uuid(),
              type: 'request',
              name: 'JSONPlaceholder — Posts',
              method: 'GET',
              url: 'https://jsonplaceholder.typicode.com/posts/1',
              params: [],
              headers: [{ id: uuid(), key: 'Accept', value: 'application/json', enabled: true }],
              auth: { type: 'none' },
              body: { mode: 'none', raw: '', rawType: 'json', formData: [], urlencoded: [] },
            },
            {
              id: uuid(),
              type: 'request',
              name: 'Create Post',
              method: 'POST',
              url: 'https://jsonplaceholder.typicode.com/posts',
              params: [],
              headers: [
                { id: uuid(), key: 'Content-Type', value: 'application/json', enabled: true },
                { id: uuid(), key: 'Accept', value: 'application/json', enabled: true },
              ],
              auth: { type: 'none' },
              body: {
                mode: 'raw',
                rawType: 'json',
                raw: JSON.stringify({ title: 'API Messenger', body: 'Hello from local storage', userId: 1 }, null, 2),
                formData: [],
                urlencoded: [],
              },
            },
            {
              id: uuid(),
              type: 'request',
              name: 'HTTPBin — Echo',
              method: 'GET',
              url: 'https://httpbin.org/get',
              params: [
                { id: uuid(), key: 'from', value: 'api-messenger', enabled: true },
                { id: uuid(), key: 'env', value: '{{baseEnv}}', enabled: true },
              ],
              headers: [],
              auth: { type: 'none' },
              body: { mode: 'none', raw: '', rawType: 'json', formData: [], urlencoded: [] },
            },
          ],
        },
      ],
    })
  }

  if (envs.length === 0) {
    const local = await createEnvironment({
      name: 'Local',
      variables: [
        { id: uuid(), key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
        { id: uuid(), key: 'baseEnv', value: 'local', enabled: true },
        { id: uuid(), key: 'token', value: '', enabled: true },
      ],
    })
    await saveSettings({ activeEnvironmentId: local.id })
  }
}
