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
  let vertexList = []
  let indexList = []
  let colorList = []
  let vertexOffset = 0
  let hasColors = false
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
      // Extract vertices and append to list
      const vertices = Array.from(positionAccessor.getArray())
      vertexList.push(...vertices)
      // Extract indices, adjust for offset, and append
      const indices = Array.from(indicesAccessor.getArray()).map((index) => index + vertexOffset)
      indexList.push(...indices)
      // Extract colors if they exist
      const colorAccessor = primitive.getAttribute('COLOR_0')
      if (colorAccessor) {
        const colors = Array.from(colorAccessor.getArray())
        if (colors.length / positionAccessor.getCount() === 3) {
          for (let i = 0; i < colors.length; i += 3) {
            colorList.push(colors[i] / 255, colors[i + 1] / 255, colors[i + 2] / 255, 255)
          }
        } else if (colors.length / positionAccessor.getCount() === 4) {
          colorList.push(...colors)
        }
        hasColors = true
      } else {
        // Fill with default colors if we already encountered colors in another primitive
        if (hasColors) {
          for (let i = 0; i < positionAccessor.getCount(); i++) {
            colorList.push(1, 1, 1) // Default white if some primitives have colors but others don’t
          }
        }
      }
      // Update vertex offset
      vertexOffset += positionAccessor.getCount()
    }
  }

  return {
    positions: new Float32Array(vertexList),
    indices: new Int32Array(indexList),
    colors: hasColors ? new Uint8Array(colorList) : null
  }
}
