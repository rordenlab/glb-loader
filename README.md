## glb-loader

The glb-loader is a NiiVue plugin that converts [glTF (Graphics Library Transmission Format) binary files (.glb)](https://en.wikipedia.org/wiki/GlTF) files into mz3 meshes. While glTF enables compact, fast-transferring files, it remains uncommon in neuroimaging. Additionally, supporting glTF introduces dependencies. Specifically, here we use the [glTF Transform](https://gltf-transform.dev/) library installed as a [npm package](https://www.npmjs.com/package/@gltf-transform/core).  By offering glTF support as an optional plugin, NiiVue stays lightweight while providing compatibility when needed.

![Example glTF mesh of Isopropylamine doi.org/10.60705/3dpx/8721.2](isopropylamine.jpg)

## Local Development

To illustrate this library, `glb2mz3` is a node.js converter that can be run from the command line:

```
git clone git@github.com:rordenlab/glb-loader.git
cd glb-loader
npm install
node ./src/glb2mz3.js ./tests/testData/mesh.glb
```

## Local Browser Development

You can also embed this loader into a hot-reloadable NiiVue web page to evaluate integration:

```
git clone git@github.com:rordenlab/glb-loader.git
cd glb-loader
npm install
npm run dev
```

## Sample datasets

- [NIH 3D](https://3d.nih.gov/) provides thousands of GLB meashs. Note the sample meshes included in this repository are from here.