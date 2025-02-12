import { Niivue } from '@niivue/niivue'
import { glb2mz3 } from './lib/loader'

export async function setupNiivue(element) {
  const nv = new Niivue({ backColor: [1, 1, 1, 1] })
  nv.attachToCanvas(element)
  // supply loader function, fromExt, and toExt (without dots)
  nv.useLoader(glb2mz3, 'glb', 'mz3')
  await nv.loadMeshes([
    {
      url: '/water-bas-color-print_NIH3D.glb'
    }
  ])
}
