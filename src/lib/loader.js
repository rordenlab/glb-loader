import { WebIO } from '@gltf-transform/core'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import draco3d from 'draco3dgltf'

// Load Draco from an external script in the browser
async function loadDracoDecoder() {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    // script.src = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/draco_decoder.js';
    script.src = './draco_decoder.1.5.7.js'
    script.onload = () => {
      resolve(DracoDecoderModule())
    }
    document.body.appendChild(script)
  })
}

export async function glb2mz3(arrayBuffer) {
  let doc = []
  const isNode = typeof window === 'undefined' && typeof document === 'undefined'
  if (isNode) {
    const dracoDecoder = await draco3d.createDecoderModule()
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': dracoDecoder,
      'meshopt.decoder': MeshoptDecoder
    })
    doc = await io.readBinary(new Uint8Array(arrayBuffer)) // Load GLB file
  } else {
    const dracoDecoder = await loadDracoDecoder()
    await MeshoptDecoder.ready
    const io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': dracoDecoder,
      'meshopt.decoder': MeshoptDecoder
    })
    doc = await io.readBinary(new Uint8Array(arrayBuffer)) // Load GLB file
  }
  const root = doc.getRoot()
  const meshes = root.listMeshes()
  if (meshes.length === 0) {
    throw new Error('No meshes found in GLB file.')
  }
  // ---- two-pass conversion (simple push can overflow stack) ----

  let primitiveInfos = []

  let totalVertices = 0 // number of vertices (not floats)
  let totalVertexFloats = 0 // number of float components (3 * totalVertices)
  let totalIndices = 0 // number of indices
  let hasColors = false // true if any primitive has color
  let totalColorBytes = 0 // bytes for colors (4 per vertex if hasColors)
  for (const mesh of meshes) {
    for (const primitive of mesh.listPrimitives()) {
      const positionAccessor = primitive.getAttribute('POSITION')
      if (!positionAccessor) {
        throw new Error('No POSITION attribute found in primitive.')
      }
      const indicesAccessor = primitive.getIndices()
      if (!indicesAccessor) {
        throw new Error('No indices found in primitive.')
      }
      const vertexCount = positionAccessor.getCount()
      const indexCount = indicesAccessor.getCount()

      const colorAccessor = primitive.getAttribute('COLOR_0')
      let colorComponents = 0
      if (colorAccessor) {
        // Determine number of components per vertex for this color accessor
        // Prefer checking the accessor length if available, otherwise fallback to reading the array length later.
        const colorArrayCandidate = colorAccessor.getArray ? colorAccessor.getArray() : null
        if (colorArrayCandidate) {
          colorComponents = colorArrayCandidate.length / vertexCount
        } else {
          // fallback guess
          colorComponents = 4
        }
        hasColors = true
      }
      primitiveInfos.push({
        primitive,
        vertexCount,
        indexCount,
        colorComponents,
        positionAccessor,
        indicesAccessor,
        colorAccessor,
        name: mesh.getName()
      })

      totalVertices += vertexCount
      totalVertexFloats += vertexCount * 3 // x,y,z floats
      totalIndices += indexCount
      // reserve 4 bytes per vertex if any primitive has colors (we will fill defaults where missing)
      if (hasColors) {
        totalColorBytes = totalVertices * 4
      }
    }
  }

  // If some primitives were discovered to have colors after initial increments,
  // we need to ensure totalColorBytes accounts for all vertices.
  // Recompute safe totalColorBytes if hasColors
  if (hasColors) {
    totalColorBytes = totalVertices * 4
  }

  // Allocate typed arrays of exact sizes
  const vertexList = new Float32Array(totalVertexFloats)
  const indexList = new Uint32Array(totalIndices)
  const colorList = hasColors ? new Uint8Array(totalVertices * 4) : null

  // Second pass: fill buffers
  let vertexFloatOffset = 0 // position in floats
  let indexOffset = 0 // position in indices
  let vertexOffset = 0 // vertex offset used to adjust indices (in vertex counts)
  let colorByteOffset = 0 // byte position in colorList (if present)
  let hasAnnotation =
    primitiveInfos.length > 1 &&
    primitiveInfos[0].name.length > 0 &&
    hasColors &&
    primitiveInfos[0].colorComponents >= 3
  let annotation = {
    R: [],
    G: [],
    B: [],
    I: [],
    labels: []
  }
  const scalars = new Float32Array(totalVertices)
  let nScalars = 0

  for (let i = 0; i < primitiveInfos.length; i++) {
    const info = primitiveInfos[i]
    const { primitive, vertexCount, indexCount, colorComponents, positionAccessor, indicesAccessor, colorAccessor } =
      info

    if (vertexCount < 1) continue
    // positionAccessor.getArray() usually returns a typed array (Float32Array)
    const posArray = Array.from(positionAccessor.getArray()) // ensure it's a plain array or typed array; .set will accept either
    // faster: if posArray is already a typed array, we can avoid Array.from; but using set with posArray is OK
    // posArray length = vertexCount * 3
    vertexList.set(posArray, vertexFloatOffset)
    vertexFloatOffset += vertexCount * 3

    // copy indices and add vertexOffset
    const idxArray = Array.from(indicesAccessor.getArray()) // may be Uint16Array / Uint32Array
    for (let i = 0; i < idxArray.length; i++) {
      indexList[indexOffset + i] = idxArray[i] + vertexOffset
    }
    indexOffset += idxArray.length

    // colors handling:
    if (hasColors) {
      if (colorAccessor) {
        const rawColors = Array.from(colorAccessor.getArray())
        // rawColors length is vertexCount * colorComponents (3 or 4)
        if (Math.abs(rawColors.length / vertexCount - 3) < 1e-6) {
          // Per-vertex RGB (3 components). We will emit RGBA with A=255.
          for (let v = 0; v < vertexCount; v++) {
            let r = rawColors[v * 3 + 0]
            let g = rawColors[v * 3 + 1]
            let b = rawColors[v * 3 + 2]
            // if values look normalized (<= 1), scale to 0..255
            if (r <= 1 && g <= 1 && b <= 1) {
              r = Math.round(r * 255)
              g = Math.round(g * 255)
              b = Math.round(b * 255)
            } else {
              r = Math.round(r)
              g = Math.round(g)
              b = Math.round(b)
            }
            colorList[colorByteOffset++] = r
            colorList[colorByteOffset++] = g
            colorList[colorByteOffset++] = b
            colorList[colorByteOffset++] = 255 // opaque alpha
          }
        } else if (Math.abs(rawColors.length / vertexCount - 4) < 1e-6) {
          // Per-vertex RGBA (4 components)
          for (let v = 0; v < vertexCount; v++) {
            let r = rawColors[v * 4 + 0]
            let g = rawColors[v * 4 + 1]
            let b = rawColors[v * 4 + 2]
            let a = rawColors[v * 4 + 3]
            if (r <= 1 && g <= 1 && b <= 1 && a <= 1) {
              r = Math.round(r * 255)
              g = Math.round(g * 255)
              b = Math.round(b * 255)
              a = Math.round(a * 255)
            } else {
              r = Math.round(r)
              g = Math.round(g)
              b = Math.round(b)
              a = Math.round(a)
            }
            colorList[colorByteOffset++] = r
            colorList[colorByteOffset++] = g
            colorList[colorByteOffset++] = b
            colorList[colorByteOffset++] = a
          }
        } else {
          // unexpected component count — fill defaults
          for (let v = 0; v < vertexCount; v++) {
            colorList[colorByteOffset++] = 255
            colorList[colorByteOffset++] = 255
            colorList[colorByteOffset++] = 255
            colorList[colorByteOffset++] = 255
          }
        }
      } else {
        // primitive has no colors but some other primitives do — fill default white (255,255,255,255)
        for (let v = 0; v < vertexCount; v++) {
          colorList[colorByteOffset++] = 255
          colorList[colorByteOffset++] = 255
          colorList[colorByteOffset++] = 255
          colorList[colorByteOffset++] = 255
        }
      }
      if (hasAnnotation) {
        //todo
        const name = info.name || '(unnamed)'
        const r = colorList[colorByteOffset - 4]
        const g = colorList[colorByteOffset - 3]
        const b = colorList[colorByteOffset - 2]
        annotation.R.push(r)
        annotation.G.push(g)
        annotation.B.push(b)
        annotation.I.push(i)
        annotation.labels.push(name)
        for (let v = 0; v < vertexCount; v++) {
          scalars[nScalars + v] = i
        }
        nScalars += vertexCount
      }
    }

    // increment vertexOffset by the number of vertices we just appended
    vertexOffset += vertexCount
  }

  return {
    positions: new Float32Array(vertexList),
    indices: new Int32Array(indexList),
    colors: hasColors ? new Uint8Array(colorList) : null,
    scalars: hasAnnotation && nScalars > 0 ? scalars : null,
    colormapLabel: hasAnnotation ? annotation : null
  }
}
