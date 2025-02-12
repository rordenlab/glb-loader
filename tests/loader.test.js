import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { glb2mz3 } from '../src/lib/loader.js'

describe('GLB Conversion Tests', () => {
  it('should convert GLB to a MZ3 mesh and test properties', async () => {
    const dsFilePath = join(__dirname, 'testData', 'mesh.glb')
    const fileBuffer = await fs.readFile(dsFilePath)
    const { positions, indices, colors } = await glb2mz3(fileBuffer)
    expect(positions.length).toEqual(114)
    expect(indices.length).toEqual(216)
  })
})
