<script setup>
import * as THREE from "three";
import { ref, onMounted } from "vue";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as faceapi from "@vladmandic/face-api";
import { pixelToWorldSize, pixelToSceneCoords } from "./utils";
import GUI from 'lil-gui';

let optionsSSDMobileNet;
const sceneContainer = ref(null);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
let glasses;
let gui;
const renderer = new THREE.WebGLRenderer();
const videoTexture = ref(null);
const videoMesh = ref(null);
const video = ref(null);
const angle = ref(null)

const videoWidth = ref(0);
const videoHeight = ref(0);

let lastUpdate = 0;
const UPDATE_INTERVAL = 200; // ms

// 加载眼镜模型0.
async function loadGlassesModel() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/black_glasses.glb');
  glasses = gltf.scene;
  glasses.scale.set(0.14, 0.14, 0.14); // 调整大小
  glasses.position.set(0, 0, 0.08); // 初始位置
  scene.add(glasses);

  // 添加 GUI
  gui = new GUI();
  if (glasses) {
    const params = {
      posX: glasses.position.x,
      posY: glasses.position.y,
      posZ: glasses.position.z,
      rotX: glasses.rotation.x,
      rotY: glasses.rotation.y,
      rotZ: glasses.rotation.z,
      scale: glasses.scale.x,
    };
    gui.add(params, 'posX', -1, 1).onChange(v => glasses.position.x = v);
    gui.add(params, 'posY', -1, 1).onChange(v => glasses.position.y = v);
    gui.add(params, 'posZ', -1, 1).onChange(v => glasses.position.z = v);
    gui.add(params, 'rotX', -Math.PI, Math.PI).onChange(v => glasses.rotation.x = v);
    gui.add(params, 'rotY', -Math.PI, Math.PI).onChange(v => glasses.rotation.y = v);
    gui.add(params, 'rotZ', -Math.PI, Math.PI).onChange(v => glasses.rotation.z = v);
    gui.add(params, 'scale', 0.01, 1).onChange(v => glasses.scale.set(v, v, v));
  }
}
// 初始化场景
const initThreeJS = () => {
  camera.position.z = 1;
  renderer.setSize(window.innerWidth, window.innerHeight);
  // 将渲染器DOM元素添加到页面
  sceneContainer.value.appendChild(renderer?.domElement);
  // 动画循环
  const animate = () => {
    requestAnimationFrame(animate);
    // // 如果 videoTexture 已经创建好，更新它
    if (videoTexture.value) {
      videoTexture.value.needsUpdate = true;
    }
    // 检测人脸
    faceapi
      .detectAllFaces(video.value, optionsSSDMobileNet)
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptors()
      .then((res) => {
        const landmarks = res[0]?.landmarks;
        // 角度
        const angle = res[0]?.angle;
        onResult(landmarks, angle);
      });
    renderer.render(scene, camera);
  };
  animate();
  loadGlassesModel();
};

// 初始哈相机
const initCameraStream = () => {
  // 是否移动端
  const isMobileDevice = false;
  const constraints = {
    video: {
      // aspectRatio: window.innerWidth / window.innerHeight, // 设置视频的宽高比
      facingMode: "user", // 使用前置摄像头
      height: {
        ideal: isMobileDevice ? window.innerWidth : window.innerHeight,
      },
      width: { ideal: isMobileDevice ? window.innerHeight : window.innerWidth },
    },
  };
  // 获取摄像头流
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      video.value.srcObject = stream;
      video.value?.addEventListener("canplaythrough", () => {
        // 获取视频的比例
        const videoRatio = video.value?.videoWidth / video.value?.videoHeight;
        videoWidth.value = video.value?.videoWidth;
        videoHeight.value = video.value?.videoHeight;
        renderer.setSize(video.value.videoWidth, video.value.videoHeight);
        // 设置相机的宽高比
        camera.aspect = videoRatio;
        camera.updateProjectionMatrix();
        // 创建一个视频纹理
        videoTexture.value = new THREE.VideoTexture(video.value);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.format = THREE.RGBFormat;
        const videoPlane = pixelToWorldSize(
          video.value?.videoWidth,
          video.value?.videoHeight,
          camera,
          renderer
        );
        // 创建一个平面几何体
        const geometry = new THREE.PlaneGeometry(
          videoPlane.width,
          videoPlane.height
        );
        // 创建一个使用 videoTexture 的材质
        const material = new THREE.MeshBasicMaterial({
          map: videoTexture.value,
          transparent: true,
          name: "video",
          lightMap: videoTexture.value,
          lightMapIntensity: 4,
        });
        // 创建一个网格对象
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "video";
        // 将网格对象添加到场景中
        scene.add(mesh);
        mesh.position.set(0, 0, 0); // 将平面放置在相机前方
        videoMesh.value = mesh;
      });
    })
    .catch((err) => {
      console.error("Error accessing camera: ", err);
    });
};

function averagePoints(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}
// 识别结果
const onResult = (landmarks, angleData) => {
  angle.value = JSON.stringify(angleData);
  if (!glasses) return;
  const now = Date.now();
  if (now - lastUpdate < UPDATE_INTERVAL) return;
  lastUpdate = now;

  // 1. 计算人脸宽度
  const jaw = landmarks.getJawOutline();
  const leftJaw = jaw[0];
  const rightJaw = jaw[16];
  const faceWidthPx = Math.abs(rightJaw.x - leftJaw.x);
  // 2. 转为世界坐标宽度
  const faceWorld = pixelToWorldSize(faceWidthPx, faceWidthPx, camera, renderer);
  const glassesWidth = faceWorld.width;

  // 取两个眼角中心作为眼镜中心
  const rightEye = landmarks.getRightEye();
  const leftEye = landmarks.getLeftEye();
  const center = averagePoints(leftEye.concat(rightEye));
  const records = pixelToSceneCoords(
    center?.x,
    center?.y,
    camera,
    renderer.domElement,
    scene
  );

  // 3. 设置眼镜缩放
  const scale = glassesWidth / 1.6; // 1.6 可调;
  console.log(scale, 'scale');
  glasses.scale.set(scale, scale, scale);


  glasses.position.set(records.x, records.y);

  // 直接用angleData的yaw、pitch、roll
  // 假设angleData单位为度，需转为弧度
  const yaw = THREE.MathUtils.degToRad(angleData?.yaw || 0);
  const pitch = THREE.MathUtils.degToRad(angleData?.pitch || 0);
  const roll = THREE.MathUtils.degToRad(angleData?.roll || 0);

  // three.js欧拉角顺序为XYZ
  // glasses.rotation.set(pitch, yaw, roll);
};

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
onMounted(async () => {
  await setupFaceAPI();
  initThreeJS();
  initCameraStream();
});
</script>

<template>
  <div class="w-screen h-screen">
    <video ref="video" class="fixed top-0 bottom-0 left-0 right-0 hidden object-cover w-full h-full" autoplay
      webkit-playsinline playsinline x5-playsinline></video>
    <div ref="sceneContainer" class="fixed top-0 bottom-0 left-0 right-0 z-10"></div>
    <div class="fixed z-20 font-bold text-red-500 top-20">
      <p>video.width: {{ videoWidth }}</p>
      <p>video.height: {{ videoWidth }}</p>
      <p>angle: {{ angle }}</p>
    </div>
  </div>
</template>
