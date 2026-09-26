import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Zoom-style motion blur for the rainbow dash (see FlightScene's
// RAINBOW_DASH_FACTOR): the frame streaks outward from the vanishing
// point while the middle — where the bird and the arch are — stays sharp.
//
// Takes over R3F's render loop (a positive useFrame priority), but only
// pays for the extra pass while `amountRef` is above zero; otherwise it's
// a plain gl.render(), same as R3F's own. Deliberately not three's
// EffectComposer: its OutputPass would sRGB-encode the ocean shader's raw
// output a second time and wash the sea out. Rendering into a target
// whose texture is tagged sRGB makes every material encode exactly as it
// does straight to the screen, and the blur quad then copies it raw.

const SAMPLES = 16;

const blurVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const blurFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uAmount;
  uniform vec2 uCenter;
  varying vec2 vUv;
  void main() {
    vec2 toCenter = vUv - uCenter;
    // Sharp in the middle, streaking toward the edges.
    float reach = uAmount * smoothstep(0.08, 0.55, length(toCenter));
    vec4 sum = vec4(0.0);
    for (int i = 0; i < ${SAMPLES}; i++) {
      float t = float(i) / float(${SAMPLES - 1});
      sum += texture2D(tDiffuse, uCenter + toCenter * (1.0 - reach * t));
    }
    gl_FragColor = sum / float(${SAMPLES});
  }
`;

export function MotionBlur({ amountRef }: { amountRef: React.RefObject<number> }) {
  const gl = useThree((s) => s.gl);
  const { target, quadScene, quadCamera, material } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    const material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: target.texture }, uAmount: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.56) } },
      vertexShader: blurVertex,
      fragmentShader: blurFragment,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    return { target, quadScene, quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
  }, []);
  useEffect(
    () => () => {
      target.dispose();
      material.dispose();
    },
    [target, material],
  );
  const bufferSize = useMemo(() => new THREE.Vector2(), []);

  useFrame(({ scene, camera }) => {
    const amount = amountRef.current ?? 0;
    if (amount < 0.005) {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }
    gl.getDrawingBufferSize(bufferSize);
    if (target.width !== bufferSize.x || target.height !== bufferSize.y) target.setSize(bufferSize.x, bufferSize.y);
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    material.uniforms.uAmount.value = amount;
    gl.render(quadScene, quadCamera);
  }, 1);

  return null;
}
