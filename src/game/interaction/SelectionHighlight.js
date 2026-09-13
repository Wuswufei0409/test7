import * as THREE from 'three';

export class SelectionHighlight {
  constructor(scene) {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008));
    this.mesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    }));
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  show(position) {
    this.mesh.position.set(position[0] + 0.5, position[1] + 0.5, position[2] + 0.5);
    this.mesh.visible = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}
