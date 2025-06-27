<script setup>
import * as THREE from "three";
import { ref, onMounted } from "vue";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as faceapi from "@vladmandic/face-api";
import { pixelToWorldSize, pixelToSceneCoords } from "./utils";

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
const renderer = new THREE.WebGLRenderer();
const videoTexture = ref(null);
const videoMesh = ref(null);
const video = ref(null);
const glassesMeshe = ref(null);
const angle = ref(null)

const videoWidth = ref(0);
const videoHeight = ref(0);

// 加载眼镜模型
async function loadGlassesModel() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/glasses.glb');
  glasses = gltf.scene;
  glasses.scale.set(0.1, 0.1, 0.1); // 调整大小
  glasses.position.set(0, 0, 2);
  scene.add(glasses);
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
// 识别结果
const onResult = (landmarks, angleData) => {
  if(!glasses) return;
  angle.value = JSON.stringify(angleData);
  // 获取鼻子的特征点
  const nose = landmarks?.getNose();
  const leftEye = landmarks?.getLeftEye();
  console.log('leftEye:', leftEye);
  // const rightEye = landmarks?.getRightEye();
  // const yaw = Math.atan2(
  //   rightEye[0].y - leftEye[0].y,
  //   rightEye[0].x - leftEye[0].x
  // );
  const records = pixelToSceneCoords(
    nose[0]?.x,
    nose[0]?.y,
    camera,
    renderer.domElement,
    scene
  );
  const x = records.x;
  const y = records.y;
  const z = records.z;
  glasses.position.set(x, y, z);
  // glasses.rotation.set(0, yaw, 0); // 设置眼镜的旋转
  glasses.lookAt(camera.position);
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
