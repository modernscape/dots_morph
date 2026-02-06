"use client"

import {useRef, useMemo, Suspense} from "react"
import {Canvas, useFrame} from "@react-three/fiber"
import {useGLTF, OrbitControls, PerspectiveCamera} from "@react-three/drei"
import {MeshSurfaceSampler} from "three/examples/jsm/math/MeshSurfaceSampler.js"
import * as THREE from "three"
import {GLTF} from "three/examples/jsm/Addons.js"

// ---------------------- ParticleMorph コンポーネント ----------------------
interface ParticleMorphProps {
  modelA: string
  modelB: string
  count?: number
  offsetA?: number
  offsetB?: number
}

const ParticleMorph = ({modelA, modelB, count = 10000, offsetA = 0, offsetB = 0}: ParticleMorphProps) => {
  const meshRef = useRef<THREE.Points>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const {nodes: nodesA} = useGLTF(modelA) as unknown as GLTF & {
    nodes: {[key: string]: THREE.Object3D}
  }
  const {nodes: nodesB} = useGLTF(modelB) as unknown as GLTF & {
    nodes: {[key: string]: THREE.Object3D}
  }

  const particles = useMemo(() => {
    const posA = new Float32Array(count * 3)
    const posB = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const sampleMesh = (scene: THREE.Object3D, posArray: Float32Array, isFirst: boolean) => {
      let mesh: THREE.Mesh | null = null
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) mesh = child as THREE.Mesh

        if (!mesh) return

        if (mesh instanceof THREE.Mesh) {
          const material = mesh.material

          // ここで material が使える
          // モデル中心を計算
          const box = new THREE.Box3().setFromObject(mesh)
          const center = new THREE.Vector3()
          box.getCenter(center)

          const sampler = new MeshSurfaceSampler(mesh).build()
          const tempPos = new THREE.Vector3()
          const tempColor = new THREE.Color()

          const materialColor = (material as THREE.MeshStandardMaterial)?.color ?? new THREE.Color(1, 1, 1)

          for (let i = 0; i < count; i++) {
            sampler.sample(tempPos, undefined, tempColor)
            posArray[i * 3 + 0] = tempPos.x - center.x
            posArray[i * 3 + 1] = tempPos.y - center.y
            posArray[i * 3 + 2] = tempPos.z - center.z

            if (isFirst) {
              colors[i * 3 + 0] = materialColor.r
              colors[i * 3 + 1] = materialColor.g
              colors[i * 3 + 2] = materialColor.b
            }
          }
        }
      })
    }

    sampleMesh(nodesA.Scene || nodesA, posA, true)
    sampleMesh(nodesB.Scene || nodesB, posB, false)

    return {posA, posB, colors}
  }, [nodesA, nodesB, count])

  // const uniforms = useMemo(() => ({uProgress: {value: 0}}), [])

  const uniforms = useMemo(
    () => ({
      uProgress: {value: 0},
      uOffsetA: {value: -2.0},
      uOffsetB: {value: 2.0},
    }),
    [],
  )

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = (Math.sin(state.clock.elapsedTime * 0.7) + 1) / 2
    }
  })

  return (
    <points ref={meshRef} position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particles.posA, 3]} />
        <bufferAttribute attach="attributes-target" args={[particles.posB, 3]} />
        <bufferAttribute attach="attributes-color" args={[particles.colors, 3]} />
      </bufferGeometry>

      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexColors
        vertexShader={`
    varying vec3 vColor;
    uniform float uProgress;
    uniform float uOffsetA;
    uniform float uOffsetB;
    attribute vec3 target;

    void main() {
      vColor = color;

      vec3 posA = position + vec3(uOffsetA, 0.0, 0.0);
      vec3 posB = target   + vec3(uOffsetB, 0.0, 0.0);

      vec3 pos = mix(posA, posB, uProgress);

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = 3.0 * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `}
        fragmentShader={`
    varying vec3 vColor;
    void main() {
      if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
      gl_FragColor = vec4(vColor, 1.0);
    }
  `}
        vertexColors
        transparent
      />
    </points>
  )
}

// ---------------------- MainScene ----------------------
function MainScene({modelA, modelB}: {modelA: string; modelB: string}) {
  const distance = 4 // モデル間の距離
  return (
    <>
      {/* 中心に赤い球とAxesHelper */}
      {/* <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="red" />
      </mesh> */}
      <primitive object={new THREE.AxesHelper(2)} />

      <ParticleMorph
        modelA={modelA}
        modelB={modelB}
        offsetA={-distance / 2} // 左側に移動
        offsetB={distance / 2}
      />
    </>
  )
}

// ---------------------- ParticleScene ----------------------
export default function ParticleScene() {
  return (
    <div style={{width: "100vw", height: "100vh", background: "#000", margin: 0, padding: 0}}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={50} />
        <OrbitControls target={[0, 0, 0]} makeDefault enableRotate enablePan={false} />
        <ambientLight intensity={0.5} />
        <Suspense fallback={null}>
          <MainScene modelA="/24-11-10_sphere.glb" modelB="/24-11-15_torus2.glb" />
        </Suspense>
      </Canvas>
    </div>
  )
}
