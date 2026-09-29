import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { MemoryInput, MemoryItem } from '@jarvis/contracts'
import { validateMemoryInput } from './memoryPolicy'

function memoryPath(): string {
  return join(app.getPath('userData'), 'private', 'memories.json')
}

async function readMemories(): Promise<MemoryItem[]> {
  try {
    return JSON.parse(await readFile(memoryPath(), 'utf8')) as MemoryItem[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeMemories(items: MemoryItem[]): Promise<void> {
  const path = memoryPath()
  const temp = `${path}.tmp`
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(temp, JSON.stringify(items, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(temp, path)
}

export async function listMemories(query = ''): Promise<MemoryItem[]> {
  const items = await readMemories()
  const term = query.trim().toLowerCase()
  return items
    .filter((item) => !term || `${item.title}\n${item.content}\n${item.source ?? ''}`.toLowerCase().includes(term))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveMemory(input: MemoryInput): Promise<MemoryItem> {
  const valid = validateMemoryInput(input)
  const now = new Date().toISOString()
  const item: MemoryItem = { ...valid, id: randomUUID(), createdAt: now, updatedAt: now }
  const items = await readMemories()
  items.push(item)
  await writeMemories(items)
  return item
}
