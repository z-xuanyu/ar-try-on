<!--
 * @Author: 阿宇 969718197@qq.com
 * @Date: 2024-10-16 18:19:01
 * @LastEditors: 阿宇 969718197@qq.com
 * @LastEditTime: 2025-06-24 16:59:39
 * @Description: 
-->
<template>
  <div class="relative w-screen h-screen glasses-app">
    <video ref="video" class="absolute inset-0" autoplay></video>
    <canvas ref="canvas" class="absolute inset-0 z-10"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as faceapi from "@vladmandic/face-api";

const video = ref(null);
const canvas = ref(null);
const modelPath = "/models";
const imgRef = ref(null);
const optionsSSDMobileNet = ref(null);

// 启动摄像头
const startCamera = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  });
  video.value.srcObject = stream;
  video.value?.addEventListener("canplaythrough", () => {
    canvas.value.width = video.value.videoWidth;
    canvas.value.height = video.value.videoHeight;
    detectFace();
  });
};

// 加载 face-api.js 模型
const loadFaceApiModels = async () => {
  await faceapi.nets.ssdMobilenetv1.load(modelPath);
  await faceapi.nets.ageGenderNet.load(modelPath);
  await faceapi.nets.faceLandmark68Net.load(modelPath);
  await faceapi.nets.faceRecognitionNet.load(modelPath);
  await faceapi.nets.faceExpressionNet.load(modelPath);
};

const setupFaceAPI = async () => {
  await faceapi.tf.setBackend("webgl");
  await faceapi.tf.ready();
  // tfjs optimizations
  if (faceapi.tf?.env().flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY)
    faceapi.tf.env().set("CANVAS2D_WILL_READ_FREQUENTLY", true);
  if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV)
    faceapi.tf.env().set("WEBGL_EXP_CONV", true);
  if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV)
    faceapi.tf.env().set("WEBGL_EXP_CONV", true);
  loadFaceApiModels();
  optionsSSDMobileNet.value = new faceapi.SsdMobilenetv1Options({
    minConfidence: 0.2,
    maxResults: 5,
  });
};
// 进行人脸检测并绘制眼镜
const detectFace = async () => {
  const displaySize = {
    width: video.value.videoWidth,
    height: video.value.videoHeight,
  };
  faceapi.matchDimensions(canvas.value, displaySize);
  const detections = await faceapi
    .detectAllFaces(video.value, optionsSSDMobileNet.value)
    .withFaceLandmarks()
    .withFaceDescriptors();
  const ctx = canvas.value.getContext("2d");
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height); // 清除上一次的眼镜
  if (detections.length > 0) {
    const landmarks = detections[0].landmarks;
    console.log(landmarks)
  }
};

// 使用 onMounted 生命周期钩子启动摄像头并加载模型
onMounted(async () => {
  await setupFaceAPI();
  await startCamera();
});
</script>

<style scoped></style>
