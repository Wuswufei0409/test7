/**
 * Renderer.js
 * R1 (MUL-34) — Three.js scene, camera and WebGL renderer bootstrap plus
 * window-resize handling. Renders the voxel world with crisp nearest-neighbor
 * pixel textures and a perspective first-person view.
 */

import * as THREE from 'three';

export function createRenderer(app) {
  const { container, scene } = app;

  const renderer = new THREE.WebGLRenderer({
    antialias: false, // crisp pixel look (nearest texture filtering)
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.id = 'webgl-canvas';
  container.appendChild(renderer.domElement);

  // Perspective camera: first-person field of view close to Bedrock.
  const camera = new THREE.PerspectiveCamera(
    70,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );

  // Ambient + directional sun light for block shading.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.25);
  sun.position.set(120, 160, -90);
  sun.castShadow = false;
  scene.add(sun);

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return { renderer, camera, sun, resize };
}

