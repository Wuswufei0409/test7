/**
 * Sky.js
 * R1 (MUL-34) — Sky dome, horizon haze and fog matching a bright, near-Bedrock
 * daytime aesthetic. A large inverted sphere carries a vertical gradient so the
 * horizon is lighter, and scene fog blends distant chunks into the haze.
 */

import * as THREE from 'three';

export class Sky {
  constructor(scene, renderDist) {
    this.scene = scene;
    this.renderDist = renderDist;

    // Background color used by renderer clear + fog fallback.
    this.topColor = new THREE.Color(0x79b8ff); // sky blue zenith
    this.horizonColor = new THREE.Color(0xe9f4ff); // pale horizon
    this.dayTopColor = this.topColor.clone();
    this.dayHorizonColor = this.horizonColor.clone();
    this.nightTopColor = new THREE.Color(0x071426);
    this.nightHorizonColor = new THREE.Color(0x18243b);

    // Vertical gradient dome.
    const geo = new THREE.SphereGeometry(renderDist * 0.92, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: this.topColor },
        bottomColor: { value: this.horizonColor },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = clamp(pow(max(h, 0.0), 0.6), 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.name = 'sky-dome';
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // Sun disc (original, simple).
    const sunGeo = new THREE.SphereGeometry(6, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.sun.position.set(120, 160, -90);
    this.sun.name = 'sun';
    scene.add(this.sun);

    // Fog for depth fade into the haze.
    scene.fog = new THREE.Fog(this.horizonColor, renderDist * 0.5, renderDist);
    this.ambient = new THREE.HemisphereLight(0xddeeff, 0x384020, 1.2);
    scene.add(this.ambient);
  }

  setBrightness(value) {
    const light = Math.max(0.12, Math.min(1, value));
    this.ambient.intensity = 0.25 + light;
    this.topColor.copy(this.nightTopColor).lerp(this.dayTopColor, light);
    this.horizonColor.copy(this.nightHorizonColor).lerp(this.dayHorizonColor, light);
    this.scene.background = this.horizonColor;
    this.scene.fog.color.copy(this.horizonColor);
    this.sun.visible = light > 0.35;
  }

  update(camera) {
    this.dome.position.copy(camera.position);
    this.sun.position.set(camera.position.x + 120, camera.position.y + 160, camera.position.z - 90);
  }
}
