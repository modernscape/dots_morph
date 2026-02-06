"use client"

import React, {useRef, useMemo} from "react"
import {Canvas, useFrame} from "@react-three/fiber"
import {useGLTF} from "@react-three/drei"
import {MeshSurfaceSampler} from "three/examples/jsm/math/MeshSurfaceSampler.js"
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

  // 型定義を node 単位で行う
  const {nodes: nodesA} = useGLTF(modelA) as unknown as GLTF & {
    nodes: {[key: string]: THREE.Mesh | THREE.Group}
  }
  const {nodes: nodesB} = useGLTF(modelB) as unknown as GLTF & {
    nodes: {[key: string]: THREE.Mesh | THREE.Group}
  }

  // 1. サンプリング処理
  const particles = useMemo(() => {
    const posA = new Float32Array(count * 3)
    const posB = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const sampleMesh = (scene: THREE.Object3D, posArray: Float32Array, isFirst: boolean) => {
      let mesh: THREE.Mesh | null = null

      // traverse は Object3D のメソッドなので、Group でも Mesh でも動作します
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          mesh = child as THREE.Mesh
        }
      })

      if (!mesh) return

      const sampler = new MeshSurfaceSampler(mesh).build()
      const tempPos = new THREE.Vector3()
      const tempColor = new THREE.Color()

      for (let i = 0; i < count; i++) {
        sampler.sample(tempPos, undefined, tempColor)

        posArray[i * 3 + 0] = tempPos.x
        posArray[i * 3 + 1] = tempPos.y
        posArray[i * 3 + 2] = tempPos.z

        if (isFirst) {
          colors[i * 3 + 0] = tempPos.x
          colors[i * 3 + 1] = tempPos.y
          colors[i * 3 + 2] = tempPos.z
        }

        // モデルの色を取得（頂点カラーがある場合。ない場合はMaterialの色）
        if (i === 0) {
          /* 処理の簡略化のため最初の色をベースにする等も可 */
        }
        // ここでは単純化のため、サンプリング時の位置に応じた色などを設定可能
      }
    }

    sampleMesh(nodesA.Scene || nodesA, posA, true)
    sampleMesh(nodesB.Scene || nodesB, posB, true)

    return {posA, posB, colors}
  }, [nodesA, nodesB, count])

  // 1. マテリアルを参照するための ref を作成
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  // 2. uniforms はレンダリングに関与させないため、useMemo のまま初期値だけ設定
  const uniforms = useMemo(
    () => ({
      uProgress: {value: 0},
    }),
    [],
  )

  useFrame((state) => {
    const t = (Math.sin(state.clock.elapsedTime * 0.5) + 1) / 2

    // 3. 重要：ref 経由でマテリアルの uniforms を直接書き換える
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = t
    }
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.posA}
          itemSize={3}
          // 以下の一行を追加（または args を使う形式に統一）
          args={[particles.posA, 3]}
        />
        <bufferAttribute attach="attributes-target" count={count} array={particles.posB} itemSize={3} args={[particles.posB, 3]} />
        <bufferAttribute attach="attributes-color" count={count} array={particles.colors} itemSize={3} args={[particles.colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexColors
        transparent
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vColor;
          uniform float uProgress;
          attribute vec3 target;
          void main() {
            vColor = color;
            // AからBへ座標を移動
            vec3 pos = mix(position, target, uProgress);
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = 3.0 * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          void main() {
            // 丸い点にする処理
            if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
            gl_FragColor = vec4(vColor, 1.0);
          }
        `}
      />
    </points>
  )
}

export default function ParticleScene() {
  return (
    <div style={{width: "100vw", height: "100vh", background: "#000"}}>
      <Canvas camera={{position: [0, 0, 5]}}>
        <ambientLight intensity={0.5} />
        <ParticleMorph modelA="/model1.glb" modelB="/model2.glb" />
      </Canvas>
    </div>
  )
}
