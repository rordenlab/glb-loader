#!/usr/bin/env node

import * as fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { glb2mz3 } from './lib/loader.js'
import { performance } from 'perf_hooks'

// Convert `import.meta.url` to __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function makeMz3(vertices, indices, colors) {
  const magic = 23117
  const isRGBA = colors instanceof Uint8Array && colors.length === (vertices.length / 3) * 4
  const attr = isRGBA ? 7 : 3

  const nface = indices.length / 3
  const nvert = vertices.length / 3
  const nskip = 0
  // Calculate buffer size
  const headerSize = 16
  const indexSize = nface * 3 * 4 // Uint32Array
  const vertexSize = nvert * 3 * 4 // Float32Array
  const colorSize = isRGBA ? nvert * 4 : 0 // 4 bytes per vertex if RGBA, else 0
  const totalSize = headerSize + indexSize + vertexSize + colorSize
  const buffer = new ArrayBuffer(totalSize)
  const writer = new DataView(buffer)
  // Write header
  writer.setUint16(0, magic, true)
  writer.setUint16(2, attr, true)
  writer.setUint32(4, nface, true)
  writer.setUint32(8, nvert, true)
  writer.setUint32(12, nskip, true)
  // Write indices
  let offset = headerSize
  new Uint32Array(buffer, offset, indices.length).set(indices)
  offset += indexSize
  // Write vertices
  new Float32Array(buffer, offset, vertices.length).set(vertices)
  // Write colors
  if (isRGBA) {
    offset += vertexSize
    new Uint8Array(buffer, offset, colors.length).set(colors)
  }
  return new Uint8Array(buffer)
}

// Check command-line arguments
if (process.argv.length < 3) {
  console.error('Usage: node glb2mz3.js <input.vox>')
  process.exit(1)
}

const inputFile = process.argv[2]
const outputFile = inputFile.replace(/\.glb$/, '.mz3')

// Read and parse the `.gltf` file
async function convertVoxToNifti() {
  try {
    const data = await fs.readFile(inputFile)
    const startTime = performance.now()
    const { positions, indices, colors } = await glb2mz3(data.buffer, true)
    const mz3 = makeMz3(positions, indices, colors)
    await fs.writeFile(outputFile, Buffer.from(mz3.buffer))
    console.log(`Converted to ${outputFile} in ${Math.round(performance.now() - startTime)}ms`)
  } catch (error) {
    console.error('Error processing file:', error.message)
  }
}

convertVoxToNifti()
