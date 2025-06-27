<!--
 * @Author: 阿宇 969718197@qq.com
 * @Date: 2024-10-16 18:19:01
 * @LastEditors: 阿宇 969718197@qq.com
 * @LastEditTime: 2025-06-25 17:01:38
 * @Description: 
-->
<script setup lang='ts'>

import * as THREE from 'three';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { FaceMesh } from '@mediapipe/face_mesh';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { pixelToWorldSize } from './utils';
import * as faceapi from "@vladmandic/face-api";

const videoElement = ref<HTMLVideoElement>();
const sceneContainer = ref<HTMLDivElement>();
let scene: THREE.Scene;
let faceMesh: FaceMesh;
let animateInterval: ReturnType<typeof setInterval>;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let points: THREE.Points;
let glasses;
let optionsSSDMobileNet: faceapi.SsdMobilenetv1Options;

// 加载眼镜模型
async function loadGlassesModel() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/glasses.glb');
  glasses = gltf.scene;
  glasses.scale.set(0.2, 0.2, 0.2); // 调整大小
  glasses.position.set(0, 0, -1.5);
  scene.add(glasses);
}

// 实时视频画面渲染到场景中
function renderVideo() {
  const videoTexture = new THREE.VideoTexture(videoElement.value!);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.format = THREE.RGBFormat;
  const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture, transparent: true, name: 'video', lightMap: videoTexture, lightMapIntensity: 4 });
  const videoPlane = pixelToWorldSize(
    videoElement.value?.videoWidth,
    videoElement.value?.videoHeight,
    camera,
    renderer
  );
  // console.log('videoPlane:', videoPlane);
  const videoGeometry = new THREE.PlaneGeometry(videoPlane.width, videoPlane.height); // 全屏
  const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
  videoMesh.position.set(0, 0, 1);
  scene.add(videoMesh);
}

// 初始化场景
function initThree() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 1
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  sceneContainer.value?.appendChild(renderer.domElement)
  // 点云材质
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(468 * 3) // 每个点3个值（x,y,z）
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({ color: 0xf60f60, size: 0.01 })
  points = new THREE.Points(geometry, material)
  scene.add(points)
  // 加载眼镜模型
  // loadGlassesModel();
}

function mapLandmark(pt: any) {
  return new THREE.Vector3(
    (pt.x - 0.5) * 2,
    -(pt.y - 0.5) * 2,
    -pt.z
  )
}

// 识别结果
function onResults(results) {
  console.log('FaceMesh results:', results);
  if (results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    const positions = points.geometry.attributes.position.array
    for (let i = 0; i < landmarks.length; i++) {
      const pt = landmarks[i]
      // 坐标缩放 & 转换
      const x = (pt.x - 0.5) * 2     // [-1, 1]
      const y = -(pt.y - 0.5) * 2    // [-1, 1], y轴倒置
      const z = -pt.z                // z 是深度（负数往里）

      positions[i * 3 + 0] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
    }
    points.geometry.attributes.position.needsUpdate = true

    // 更新眼镜位置
    if (glasses) {
      const leftEye = mapLandmark(landmarks[33])
      const rightEye = mapLandmark(landmarks[263])
      const center = leftEye.clone().add(rightEye).multiplyScalar(0.5)

      glasses.position.copy(center)

      // 简化的旋转：计算左右方向向量
      const dir = rightEye.clone().sub(leftEye).normalize()
      const up = new THREE.Vector3(0, 1, 0)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir)
      glasses.setRotationFromQuaternion(quaternion)
      // 眼镜朝向摄像机
      glasses.lookAt(camera.position);
      // 确保眼镜在脸前面
      // glasses.position.z = Math.max(glasses.position.z, -1.2);
    }
  }
}

// face-api
async function setupFaceAPI() {
  await faceapi.tf.setBackend("webgl");
  await faceapi.tf.ready();
  if (faceapi.tf?.env().flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY)
    faceapi.tf.env().set("CANVAS2D_WILL_READ_FREQUENTLY", true);
  if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV)
    faceapi.tf.env().set("WEBGL_EXP_CONV", true);
  if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV)
    faceapi.tf.env().set("WEBGL_EXP_CONV", true);
  const modelPath = "/models";
  await faceapi.nets.ssdMobilenetv1.load(modelPath);
  await faceapi.nets.faceLandmark68Net.load(modelPath);
  await faceapi.nets.faceRecognitionNet.load(modelPath);
  await faceapi.nets.faceExpressionNet.load(modelPath);
  optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({
    minConfidence: 0.2,
    maxResults: 0.5,
  });
}

// 识别模型
async function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  faceMesh.onResults(onResults);
  await setupCamera();
  animateInterval = setInterval(() => {
    animate();
  }, 200);
}
// 打开相机
async function setupCamera() {
  const isMobileDevice = false;
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user", // 使用前置摄像头
      height: {
        ideal: isMobileDevice ? window.innerWidth : window.innerHeight,
      },
      width: { ideal: isMobileDevice ? window.innerHeight : window.innerWidth },
    }
  });
  if (videoElement.value) videoElement.value.srcObject = stream;
  await videoElement.value?.play();
  videoElement.value?.addEventListener('canplaythrough', () => {
    // 确保视频加载完成
    console.log(videoElement.value, 'canplaythrough');
    if (videoElement.value) {
      videoElement.value.width = videoElement.value.videoWidth;
      videoElement.value.height = videoElement.value.videoHeight;
      camera.aspect = videoElement.value.videoWidth / videoElement.value.videoHeight;
      renderer.setSize(videoElement.value.videoWidth, videoElement.value.videoHeight);
      camera.updateProjectionMatrix();
      // 加载视频
      renderVideo();
      animateInterval = setInterval(() => {
        animate();
      }, 200);
    }
  })
}
function animate() {
  if (!videoElement.value || !videoElement.value.readyState) return;
  if (!videoElement.value.videoWidth || !videoElement.value.videoHeight) return;
  if (!videoElement.value.srcObject) return;
  // faceMesh.send({ image: videoElement.value! });
  // 检测人脸
  faceapi
    .detectAllFaces(videoElement.value, optionsSSDMobileNet)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withFaceDescriptors()
    .then((res) => {
      const landmarks = res[0]?.landmarks?.positions;
      console.log('landmarks:', landmarks);
      const positions = points.geometry.attributes.position.array
      for (let i = 0; i < landmarks.length; i++) {
        const pt = landmarks[i]
        // 坐标缩放 & 转换
        const x = (pt.x - 0.5) * 2     // [-1, 1]
        const y = -(pt.y - 0.5) * 2    // [-1, 1], y轴倒置
        const z = -pt.z                // z 是深度（负数往里）

        positions[i * 3 + 0] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = z
      }
      points.geometry.attributes.position.needsUpdate = true

      // 更新眼镜位置
      if (glasses) {
        const leftEye = mapLandmark(landmarks[33])
        const rightEye = mapLandmark(landmarks[263])
        const center = leftEye.clone().add(rightEye).multiplyScalar(0.5)

        glasses.position.copy(center)

        // 简化的旋转：计算左右方向向量
        const dir = rightEye.clone().sub(leftEye).normalize()
        const up = new THREE.Vector3(0, 1, 0)
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir)
        glasses.setRotationFromQuaternion(quaternion)
        // 眼镜朝向摄像机
        glasses.lookAt(camera.position);
        // 确保眼镜在脸前面
        // glasses.position.z = Math.max(glasses.position.z, -1.2);
      }
    });
  renderer.render(scene, camera);
}
onMounted(async () => {
  // initFaceMesh();
  initThree();
  await setupFaceAPI();
  await setupCamera();
});

onBeforeUnmount(() => {
  faceMesh.close();
  clearInterval(animateInterval);
  renderer.dispose();
})

</script>

<template>
  <div class="w-screen h-screen">
    <video ref="videoElement" class=" hidden" autoplay webkit-playsinline playsinline x5-playsinline></video>
    <div ref="sceneContainer" class="fixed top-0 bottom-0 left-0 right-0 z-10"></div>
  </div>
</template>

<style scoped lang='scss'></style>