"use client"

import {useRef, useMemo} from "react"
import {Canvas, useFrame} from "@react-three/fiber"
import {useGLTF} from "@react-three/drei"
import {MeshSurfaceSampler} from "three/examples/jsm/math/MeshSurfaceSampler.js"
import {OrbitControls, PerspectiveCamera} from "@react-three/drei"
import {Suspense} from "react"
import {GLTF} from "three/examples/jsm/Addons.js"

import * as THREE from "three"

// 引数の型を定義
interface ParticleMorphProps {
  modelA: string
  modelB: string
  count?: number
}

const ParticleMorph = ({modelA, modelB, count = 10000}: ParticleMorphProps) => {
  const meshRef = useRef<THREE.Points>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  // 1. nodes の中身が Object3D（MeshやGroupの親）であることを定義
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
      })

      if (!mesh) return

      // --- 追加: モデルの中心座標を計算 ---
      const box = new THREE.Box3().setFromObject(mesh)
      const center = new THREE.Vector3()
      box.getCenter(center)
      // --------------------------------

      const sampler = new MeshSurfaceSampler(mesh).build()
      const tempPos = new THREE.Vector3()
      const tempColor = new THREE.Color()

      for (let i = 0; i < count; i++) {
        sampler.sample(tempPos, undefined, tempColor)

        // --- 修正: 本来の位置から中心座標を引くことで (0,0,0) 中心に補正 ---
        posArray[i * 3 + 0] = tempPos.x - center.x
        posArray[i * 3 + 1] = tempPos.y - center.y
        posArray[i * 3 + 2] = tempPos.z - center.z

        if (isFirst) {
          colors[i * 3 + 0] = tempColor.r
          colors[i * 3 + 1] = tempColor.g
          colors[i * 3 + 2] = tempColor.b
        }
      }
    }

    sampleMesh(nodesA.Scene || nodesA, posA, true)
    sampleMesh(nodesB.Scene || nodesB, posB, false)

    return {posA, posB, colors}
  }, [nodesA, nodesB, count])

  const uniforms = useMemo(() => ({uProgress: {value: 0}}), [])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = (Math.sin(state.clock.elapsedTime * 0.7) + 1) / 2
    }
  })

  return (
    <points
      ref={meshRef}
      position={[0, 0, 0]} // ← ここで Points 全体を下に下げる
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={particles.posA} itemSize={3} args={[particles.posA, 3]} />
        <bufferAttribute attach="attributes-target" count={count} array={particles.posB} itemSize={3} args={[particles.posB, 3]} />
        <bufferAttribute attach="attributes-color" count={count} array={particles.colors} itemSize={3} args={[particles.colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexColors
        transparent
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vColor;
          uniform float uProgress;
          attribute vec3 target;
          void main() {
            vColor = color;
            vec3 pos = mix(position, target, uProgress);
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
      />
    </points>
  )
}

function MainScene({modelA, modelB}: {modelA: string; modelB: string}) {
  // 1. nodes の中身が Object3D（MeshやGroupの親）であることを定義
  const {nodes: nodesA} = useGLTF(modelA) as unknown as GLTF & {
    nodes: {[key: string]: THREE.Object3D}
  }

  const {nodes: nodesB} = useGLTF(modelB) as unknown as GLTF & {
    nodes: {[key: string]: THREE.Object3D}
  }
  const midPoint = useMemo(() => {
    const boxA = new THREE.Box3().setFromObject(nodesA.Scene || nodesA)
    const boxB = new THREE.Box3().setFromObject(nodesB.Scene || nodesB)
    const cA = new THREE.Vector3()
    boxA.getCenter(cA)
    const cB = new THREE.Vector3()
    boxB.getCenter(cB)
    return new THREE.Vector3().addVectors(cA, cB).multiplyScalar(0.5)
  }, [nodesA, nodesB])

  return (
    <>
      {/* <OrbitControls
        target={[midPoint.x, midPoint.y, midPoint.z]} //
        makeDefault
        enableDamping
        enablePan={false} // ← 右クリック等による平行移動を無効化（必要なら）
        enableZoom={true} // ← ズームだけは残す場合は true
      /> */}

      <ambientLight intensity={0.5} />

      {/* 1. 中点に赤い球体を表示するヘルパー（確認用） */}
      {/* <mesh position={[midPoint.x, midPoint.y, midPoint.z]}> */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="red" />
      </mesh>

      {/* <primitive object={new THREE.AxesHelper(2)} position={[midPoint.x, midPoint.y, midPoint.z]} /> */}
      <primitive object={new THREE.AxesHelper(2)} position={[0, 0, 0]} />
      <ParticleMorph modelA={modelA} modelB={modelB} />
    </>
  )
}

export default function ParticleScene() {
  return (
    <div style={{width: "100vw", height: "100vh", background: "#000", margin: 0, padding: 0}}>
      {/* <Canvas camera={{position: [0, 5, 10]}}> */}
      <Canvas>
        <PerspectiveCamera
          makeDefault
          position={[0, 0, 10]} // ← Y を 5 から 0 に変更
          fov={50} // 視野角（お好みで）
        />

        <OrbitControls
          target={[0, 0, 0]} // ← ここを [0, 0, 0] に固定
          makeDefault
          enableRotate={true}
          enablePan={false}
        />

        <ambientLight intensity={0.5} />
        <Suspense fallback={null}>
          <MainScene modelA="/24-11-10_sphere.glb" modelB="/24-11-15_torus2.glb" />
        </Suspense>
      </Canvas>
    </div>
  )
}
