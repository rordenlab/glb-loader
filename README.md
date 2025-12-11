## glb-loader

The glb-loader is a NiiVue plugin that converts [glTF (Graphics Library Transmission Format) binary files (.glb)](https://en.wikipedia.org/wiki/GlTF) files into mz3 meshes. While glTF enables compact, fast-transferring files, it remains uncommon in neuroimaging. Additionally, supporting glTF introduces dependencies. Specifically, here we use the [glTF Transform](https://gltf-transform.dev/) library installed as a [npm package](https://www.npmjs.com/package/@gltf-transform/core).  By offering glTF support as an optional plugin, NiiVue stays lightweight while providing compatibility when needed.

![Example glTF mesh of Isopropylamine doi.org/10.60705/3dpx/8721.2](isopropylamine.jpg)

## Local Development

To illustrate this library, `glb2mz3` is a node.js converter that can be run from the command line:

```bash
git clone git@github.com:rordenlab/glb-loader.git
cd glb-loader
npm install
node ./src/glb2mz3.js ./tests/testData/mesh.glb
```

## Local Browser Development

You can also embed this loader into a hot-reloadable NiiVue web page to evaluate integration:

```bash
git clone git@github.com:rordenlab/glb-loader.git
cd glb-loader
npm install
npm run dev
```

## Contributing

If you plan to contribute to this repository, please ensure your changes are tested and follow the project’s formatting rules:

```bash
npm run pretty
npm run test
```

## Sample datasets

- [NIH 3D](https://3d.nih.gov/) provides thousands of GLB meshes. Note the sample meshes included in this repository are from here.
- [morphosource](https://www.morphosource.org/concern/media/000751555?locale=en) provides annotated GLB meshes.

## Draco compression

This library also supports glTF .glb files optimized with [Draco mesh compression](https://google.github.io/draco/). Note that the vertex reording may disrupt mesh overlays (e.g. statistical maps, gray matter thickness, curvature) and [decimation properties](https://brainder.org/2016/05/31/downsampling-decimating-a-brain-surface/). While this dramatically reduces file size, be warned that these compressed not compatible with all glTF viewers. For these reasons, most glTF files (including sample data from NIH 3D) are not compressed this way. You can compress glTF meshes to use Draco from the [command line](https://gltf-transform.dev/):

```bash
npm install --global @gltf-transform/cli
gltf-transform optimize water-bas-color-print_NIH3D.glb water.glb --compress draco --texture-compress webp
```
