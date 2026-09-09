import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'share', 'API-Messenger')
const zipPath = path.join(root, 'share', 'API-Messenger-portable.zip')

async function rmrf(p) {
  await fs.rm(p, { recursive: true, force: true })
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) await copyDir(from, to)
    else await fs.copyFile(from, to)
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

console.log('Building UI…')
execSync('npm run build', { cwd: root, stdio: 'inherit' })

console.log('Assembling share package…')
await rmrf(path.join(root, 'share'))
await fs.mkdir(outDir, { recursive: true })
await fs.mkdir(path.join(outDir, 'data', 'collections'), { recursive: true })
await fs.mkdir(path.join(outDir, 'data', 'environments'), { recursive: true })

await copyDir(path.join(root, 'server'), path.join(outDir, 'server'))
await copyDir(path.join(root, 'dist'), path.join(outDir, 'dist'))

await fs.writeFile(path.join(outDir, 'data', 'collections', '.gitkeep'), '')
await fs.writeFile(path.join(outDir, 'data', 'environments', '.gitkeep'), '')

const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
await writeJson(path.join(outDir, 'package.json'), {
  name: pkg.name,
  version: pkg.version,
  private: true,
  type: 'module',
  scripts: {
    start: 'node server/index.js',
  },
  dependencies: {
    cors: pkg.dependencies.cors,
    express: pkg.dependencies.express,
    uuid: pkg.dependencies.uuid,
  },
})

await fs.writeFile(
  path.join(outDir, 'Start API Messenger.bat'),
  `@echo off
setlocal
title API Messenger
cd /d "%~dp0"

echo.
echo  API Messenger
echo  -------------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\\" (
  echo Installing dependencies ^(first run^)...
  call npm install --omit=dev
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
  echo.
)

if not exist "dist\\index.html" (
  echo Missing dist folder. This share package is incomplete.
  pause
  exit /b 1
)

echo Starting on http://localhost:3847
echo Close this window or press Ctrl+C to stop.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3847/"

call npm start
echo.
echo Server stopped.
pause
`,
  'utf8'
)

await fs.writeFile(
  path.join(outDir, 'README.txt'),
  `API Messenger — portable package
=================================

Requirements
- Node.js 18+ (https://nodejs.org)
- Windows recommended for the .bat launcher

How to use on another PC
1. Copy this whole folder (or unzip API-Messenger-portable.zip)
2. Double-click "Start API Messenger.bat"
3. First run installs npm packages, then opens http://localhost:3847

Or from a terminal in this folder:
  npm install --omit=dev
  npm start

Data is stored locally in the data\\ folder next to this app
(collections, environments, history). Nothing is uploaded.

Stop the app by closing the console window or pressing Ctrl+C.
`,
  'utf8'
)

console.log('Creating zip…')
await rmrf(zipPath)
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${outDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
  { stdio: 'inherit' }
)

console.log('')
console.log('Share package ready:')
console.log(`  Folder: ${outDir}`)
console.log(`  Zip:    ${zipPath}`)
console.log('')
console.log('Send the zip (or the folder). Recipient needs Node.js, then runs Start API Messenger.bat')
