import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'data')

export const PATHS = {
  root,
  data: dataDir,
  collections: path.join(dataDir, 'collections'),
  environments: path.join(dataDir, 'environments'),
  history: path.join(dataDir, 'history.json'),
  settings: path.join(dataDir, 'settings.json'),
}
