/**
 * FirstPersonHand.js
 * R1 (MUL-34) — First-person held item rendered as a small block in the
 * lower-right of the view, matching Bedrock's first-person hand presentation.
 * It is parented to the camera so it moves with the view and stays in frame at
 * any resolution (positioned in view space, not pixel coordinates).
 */

import * as THREE from 'three';
import { faceTiles } from '../world/Blocks.js';

export class FirstPersonHand {
  constructor(camera, atlas) {
    this.camera = camera;
    this.atlas = atlas;
    this.group = new THREE.Group();
    this.group.name = 'first-person-hand';
    camera.add(this.group);

    // One MeshLambert material per face of the held block, each showing the
    // correct atlas sub-rect for that face's tile.
    this.mats = [];
    const geo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    for (let i = 0; i < 6; i++) this.mats.push(this._materialFor(TILES_STONE));
    this.mesh = new THREE.Mesh(geo, this.mats);
    this.mesh.position.set(0.6, -0.45, -0.9);
    this.mesh.rotation.set(0.35, -0.55, 0.05);
    this.mesh.name = 'held-block';
    this.group.add(this.mesh);
    this.setBlock(3); // default stone
  }

  _materialFor(tile) {
    const tex = this.atlas.texture.clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const r = this.atlas.tileRect(tile);
    tex.repeat.set(r.u1 - r.u0, r.v1 - r.v0);
    tex.offset.set(r.u0, r.v0);
    return new THREE.MeshLambertMaterial({ map: tex });
  }

  // BoxGeometry material order: [+x, -x, +y, -y, +z, -z]
  setBlock(blockId) {
    const tiles = faceTiles(blockId);
    // face type order in tiles: top(0), bottom(1), side(2) -> map
    const tileForBoxFace = (boxIdx) => {
      const faceNames = ['side', 'side', 'top', 'bottom', 'side', 'side'];
      const key = faceNames[boxIdx];
      return key === 'top' ? tiles.top : key === 'bottom' ? tiles.bottom : tiles.side;
    };
    for (let i = 0; i < this.mats.length; i++) {
      const tile = tileForBoxFace(i);
      const r = this.atlas.tileRect(tile);
      const tex = this.mats[i].map;
      tex.repeat.set(r.u1 - r.u0, r.v1 - r.v0);
      tex.offset.set(r.u0, r.v0);
      tex.needsUpdate = true;
    }
  }
}

const TILES_STONE = 3; // kept simple; setBlock overrides immediately
