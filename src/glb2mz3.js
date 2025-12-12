#!/usr/bin/env node

import * as fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { glb2mz3 } from './lib/loader.js'
import { performance } from 'perf_hooks'

// Convert `import.meta.url` to __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function makeMz3(vertices, indices, colors, scalars, lookup) {
  // ATTR bit flags (per spec)
  const IS_FACE = 1 // 0x01
  const IS_VERT = 2 // 0x02
  const IS_RGBA = 4 // 0x04
  const IS_SCALAR = 8 // 0x08
  const IS_LOOKUP = 64 // 0x40
  // (other bits: 16 double, 32 AOMAP)

  const MAGIC = 23117 // 0x4D5A
  const nface = indices.length / 3
  const nvert = vertices.length / 3

  // validate basic geometry
  if (!Number.isInteger(nface) || nface < 0) {
    throw new Error('indices length must be a multiple of 3')
  }
  if (!Number.isInteger(nvert) || nvert < 0) {
    throw new Error('vertices length must be a multiple of 3')
  }

  const isFace = indices && indices.length > 0
  const isVert = vertices && vertices.length > 0
  const isRGBA = colors instanceof Uint8Array && colors.length === nvert * 4

  // Prepare lookup JSON bytes (if any)
  let lookupBytes = null
  let nskip = 0
  if (lookup != null) {
    // If caller passed an object, stringify it. If already a string, use it.
    const lookupJson = typeof lookup === 'string' ? lookup : JSON.stringify(lookup)
    // Encode as UTF-8 bytes
    const encoder = new TextEncoder()
    lookupBytes = encoder.encode(lookupJson)
    nskip = lookupBytes.byteLength
  }

  // scalars: must be Float32Array and its length must be a positive integer multiple of nvert
  let isScalars = false
  let nScalarLayers = 0
  if (scalars != null) {
    if (!(scalars instanceof Float32Array)) {
      throw new Error('scalars must be a Float32Array or null/undefined')
    }
    if (nvert === 0) {
      throw new Error('cannot have scalars without vertices (nvert === 0)')
    }
    if (scalars.length > 0 && scalars.length % nvert === 0) {
      isScalars = true
      nScalarLayers = scalars.length / nvert // NSCALAR
    } else {
      throw new Error(`scalars.length (${scalars.length}) must be a positive integer multiple of nvert (${nvert})`)
    }
  }

  // Build ATTR bitfield
  let attr = 0
  if (isFace) attr |= IS_FACE
  if (isVert) attr |= IS_VERT
  if (isRGBA) attr |= IS_RGBA
  if (isScalars) attr |= IS_SCALAR
  if (lookupBytes) attr |= IS_LOOKUP

  // header and block sizes
  const headerSize = 16

  const indexSize = isFace ? nface * 3 * 4 : 0 // 3 * 4 bytes per face index (Uint32)
  const vertexSize = isVert ? nvert * 3 * 4 : 0 // 3 * 4 bytes per vertex (Float32)
  const colorSize = isRGBA ? nvert * 4 : 0 // 4 bytes per vertex (RGBA uint8)
  const scalarSize = isScalars ? nScalarLayers * nvert * 4 : 0 // NSCALAR * NVERT * 4 bytes (Float32)

  const totalSize = headerSize + nskip + indexSize + vertexSize + colorSize + scalarSize

  const buffer = new ArrayBuffer(totalSize)
  const writer = new DataView(buffer)

  // Write header (all little-endian)
  let pos = 0
  writer.setUint16(pos, MAGIC, true)
  pos += 2
  writer.setUint16(pos, attr, true)
  pos += 2
  writer.setUint32(pos, nface, true)
  pos += 4
  writer.setUint32(pos, nvert, true)
  pos += 4
  writer.setUint32(pos, nskip, true)
  pos += 4
  // pos should now equal headerSize (16)

  // Helper to copy arrays into buffer
  let offset = headerSize

  // Write NSKIP (lookup JSON) directly after header if present
  if (nskip > 0 && lookupBytes) {
    new Uint8Array(buffer, offset, lookupBytes.length).set(lookupBytes)
    offset += nskip
  }

  if (isFace) {
    // indices expected to be an array-like of integers
    new Uint32Array(buffer, offset, indices.length).set(indices)
    offset += indexSize
  }

  if (isVert) {
    new Float32Array(buffer, offset, vertices.length).set(vertices)
    offset += vertexSize
  }

  if (isRGBA) {
    new Uint8Array(buffer, offset, colors.length).set(colors)
    offset += colorSize
  }

  if (isScalars) {
    new Float32Array(buffer, offset, scalars.length).set(scalars)
    offset += scalarSize
  }

  // Final sanity: offset should equal totalSize
  if (offset !== totalSize) {
    throw new Error(`mz3 internal size mismatch: offset ${offset} !== totalSize ${totalSize}`)
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
async function convertGlbToMz3() {
  try {
    const data = await fs.readFile(inputFile)
    const startTime = performance.now()
    const { positions, indices, colors, scalars, colormapLabel } = await glb2mz3(data.buffer, true)
    const mz3 = makeMz3(positions, indices, colors, scalars, colormapLabel)
    await fs.writeFile(outputFile, Buffer.from(mz3.buffer))
    console.log(`Converted to ${outputFile} in ${Math.round(performance.now() - startTime)}ms`)
  } catch (error) {
    console.error('Error processing file:', error.message)
  }
}

convertGlbToMz3()
