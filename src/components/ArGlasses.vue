<template>
  <div class="relative w-full h-full">
    <video ref="videoRef" playsinline muted class="hidden" />
    <canvas ref="canvasRef" class="absolute top-0 left-0 w-full h-full z-10" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FaceMesh } from '@mediapipe/face_mesh'
import { Camera } from '@mediapipe/camera_utils'

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let glasses: THREE.Object3D
let threeCanvas: HTMLCanvasElement
let animationFrameId: number

onMounted(async () => {
  await initThree()
  await initFaceMesh()
})

async function initThree() {
  scene = new THREE.Scene()
  threeCanvas = canvasRef.value!
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 2

  renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)

  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(0, 0, 2)
  scene.add(light)

  // 加载镜框模型
  const loader = new GLTFLoader()
  loader.load('/src/assets/models/glasses.glb', (gltf) => {
    glasses = gltf.scene
    glasses.scale.set(0.02, 0.02, 0.02)
    scene.add(glasses)
  })
}

async function initFaceMesh() {
  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  })

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  })

  faceMesh.onResults(onFaceResults)

  const cameraUtils = new Camera(videoRef.value!, {
    onFrame: async () => {
      await faceMesh.send({ image: videoRef.value! })
    },
    width: 640,
    height: 480
  })

  cameraUtils.start()
}

function onFaceResults(results: any) {
  const landmarks = results.multiFaceLandmarks?.[0]
  if (!landmarks || !glasses) return

  const leftEye = mapLandmark(landmarks[33])
  const rightEye = mapLandmark(landmarks[263])
  const center = leftEye.clone().add(rightEye).multiplyScalar(0.5)

  glasses.position.copy(center)

  // 简化的旋转：计算左右方向向量
  const dir = rightEye.clone().sub(leftEye).normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir)
  glasses.setRotationFromQuaternion(quaternion)

  renderer.render(scene, camera)
}

function mapLandmark(pt: any) {
  return new THREE.Vector3(
    (pt.x - 0.5) * 2,
    -(pt.y - 0.5) * 2,
    -pt.z
  )
}
</script>

<style scoped>
canvas {
  width: 100%;
  height: 100%;
  position: absolute;
}
</style>
