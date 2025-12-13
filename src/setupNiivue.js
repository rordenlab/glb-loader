import { Niivue } from '@niivue/niivue'
import { glb2mz3 } from './lib/loader'

export async function setupNiivue(element) {
  colorPick.oninput = () => {
    const hex = colorPick.value
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    nv.opts.backColor = [r, g, b, 1]
    nv.drawScene()
  }
  meshSelect.onchange = function () {
    const index = this.selectedIndex
    let mesh = './water-bas-color-print_NIH3D.glb'
    if (index === 1) {
      mesh = 'https://niivue.github.io/niivue-demo-images/2UXO-ribbon-rainbow-vis_NIH3D.glb'
    }
    nv.loadMeshes([{ url: mesh }])
  }
  aboutBtn.onclick = async function () {
    alert(`NiiVue glb-loader`)
  }
  const nv = new Niivue({ backColor: [1, 1, 1, 1], show3Dcrosshair: true })
  nv.attachToCanvas(element)
  //shader selection
  let shaders = nv.meshShaderNames()
  for (let i = 0; i < shaders.length; i++) {
    let btn = document.createElement('button')
    btn.innerHTML = shaders[i]
    btn.onclick = async function () {
      nv.setMeshShader(nv.meshes[0].id, shaders[i])
    }
    shaderBtns.appendChild(btn)
  }
  // supply loader function, fromExt, and toExt (without dots)
  nv.useLoader(glb2mz3, 'glb', 'mz3')
  await nv.loadMeshes([
    {
      url: './water-bas-color-print_NIH3D.glb'
    }
  ])
}
