import * as faceapi from "@vladmandic/face-api";
import { ref } from "vue";
import cImg from "../assets/c.png";
const modelPath = "/models";
const minScore = 0.2; // minimum score
const maxResults = 5; // maximum number of results to return
let optionsSSDMobileNet;
export function useFaceApi() {
  const cImgUrl = ref("");
  function drawFaces(canvas, data, fps) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw title
    ctx.font = 'small-caps 20px "Segoe UI"';
    ctx.fillStyle = "white";
    // ctx.fillText(`FPS: ${fps}`, 10, 25);
    for (const person of data) {
      // draw box around each face
      // ctx.lineWidth = 3;
      // ctx.strokeStyle = "deepskyblue";
      // ctx.fillStyle = "deepskyblue";
      // ctx.globalAlpha = 0.6;
      // ctx.beginPath();
      // ctx.rect(
      //   person.detection.box.x,
      //   person.detection.box.y,
      //   person.detection.box.width,
      //   person.detection.box.height
      // );
      // ctx.stroke();
      // ctx.globalAlpha = 1;
      // // draw text labels
      // const expression = Object.entries(person.expressions).sort(
      //   (a, b) => b[1] - a[1]
      // );
      // ctx.fillStyle = "black";
      // ctx.fillText(
      //   `gender: ${Math.round(100 * person.genderProbability)}% ${
      //     person.gender
      //   }`,
      //   person.detection.box.x,
      //   person.detection.box.y - 59
      // );
      // ctx.fillText(
      //   `expression: ${Math.round(100 * expression[0][1])}% ${
      //     expression[0][0]
      //   }`,
      //   person.detection.box.x,
      //   person.detection.box.y - 41
      // );
      // ctx.fillText(
      //   `age: ${Math.round(person.age)} years`,
      //   person.detection.box.x,
      //   person.detection.box.y - 23
      // );
      // ctx.fillText(
      //   `roll:${person.angle.roll}° pitch:${person.angle.pitch}° yaw:${person.angle.yaw}°`,
      //   person.detection.box.x,
      //   person.detection.box.y - 5
      // );
      // ctx.fillStyle = "lightblue";
      // ctx.fillText(
      //   `gender: ${Math.round(100 * person.genderProbability)}% ${
      //     person.gender
      //   }`,
      //   person.detection.box.x,
      //   person.detection.box.y - 60
      // );
      // ctx.fillText(
      //   `expression: ${Math.round(100 * expression[0][1])}% ${
      //     expression[0][0]
      //   }`,
      //   person.detection.box.x,
      //   person.detection.box.y - 42
      // );
      // ctx.fillText(
      //   `age: ${Math.round(person.age)} years`,
      //   person.detection.box.x,
      //   person.detection.box.y - 24
      // );
      // ctx.fillText(
      //   `roll:${person.angle.roll}° pitch:${person.angle.pitch}° yaw:${person.angle.yaw}°`,
      //   person.detection.box.x,
      //   person.detection.box.y - 6
      // );
      // draw face points for each face
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "lightblue";
      const pointSize = 2;
      const leftFacePoint = person.landmarks.positions[0]; // 左侧最远点
      const rightFacePoint = person.landmarks.positions[16]; // 右侧最远点
      console.log(leftFacePoint.y, "leftFacePoint.y");
      const faceWidth = Math.sqrt(
        Math.pow(rightFacePoint.x - leftFacePoint.x, 2) +
          Math.pow(rightFacePoint.y - leftFacePoint.y, 2)
      ); // 计算人脸宽度
      // console.log(person.landmarks, "person.landmarks");
      for (let i = 0; i < person.landmarks.positions.length; i++) {
        // 鼻梁特征点
        // if (i === 27) {
        //   ctx.clearRect(0, 0, canvas.width, canvas.height);
        //   // 绘画一张图片
        //   // drawImage(canvas, cImg, person.landmarks.positions[i].x, person.landmarks.positions[i].y);
        //   ctx.drawImage(
        //     cImgUrl.value,
        //     leftFacePoint.x,
        //     leftFacePoint.y - 100,
        //     faceWidth,
        //     cImgUrl.value.height/2
        //   );
        // }
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(
          person.landmarks.positions[i].x,
          person.landmarks.positions[i].y,
          pointSize,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }
  }

  function getImgUrl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute("crossOrigin", "anonymous");
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    });
  }
  // 检测人脸
  async function detectVideo(video, canvas) {
    if (!video || video.paused) return false;
    const t0 = window.performance.now();
    faceapi
      .detectAllFaces(video, optionsSSDMobileNet)
      .withFaceLandmarks()
      // .withFaceExpressions()
      .withFaceDescriptors()
      // .withAgeAndGender()
      .then((result) => {
        const fps = 1000 / (window.performance.now() - t0);
        drawFaces(canvas, result, fps.toLocaleString());
        requestAnimationFrame(() => detectVideo(video, canvas));
        return true;
      })
      .catch((err) => {
        return false;
      });
    return false;
  }
  // 开启摄像头
  async function setupCamera() {
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    if (!video || !canvas) return null;
    if (!navigator.mediaDevices) {
      console.log("没有摄像头权限,请检查浏览器设置");
      return null;
    }
    let stream;
    const constraints = {
      audio: false,
      video: {
        facingMode: "user",
        resizeMode: "crop-and-scale",
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
    console.log(constraints, "constraints");
    // if (window.innerWidth > window.innerHeight)
    //   constraints.video.width = { ideal: window.innerWidth };
    // else constraints.video.height = { ideal: window.innerHeight };
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (
        err.name === "PermissionDeniedError" ||
        err.name === "NotAllowedError"
      )
        console.log(
          `Camera Error: camera permission denied: ${err.message || err}`
        );
      if (err.name === "SourceUnavailableError")
        console.log(
          `Camera Error: camera not available: ${err.message || err}`
        );
      return null;
    }
    if (stream) {
      video.srcObject = stream;
      video.play();
    } else {
      console.log("Camera Error: stream empty");
      return null;
    }
    // const track = stream.getVideoTracks()[0];
    // const settings = track.getSettings();
    // if (settings.deviceId) delete settings.deviceId;
    // if (settings.groupId) delete settings.groupId;
    // if (settings.aspectRatio) {
    //   settings.aspectRatio = Math.trunc(100 * settings.aspectRatio) / 100;
    // }
    // 点击画布拍照
    canvas.addEventListener("click", () => {
      if (video && video.readyState >= 2) {
        if (video.paused) {
          video.play();
          detectVideo(video, canvas);
        } else {
          video.pause();
        }
      }
    });
    return new Promise((resolve) => {
      // video.onloadeddata = async () => {
      //   console.log("video loaded");
      //   canvas.width = video.videoWidth;
      //   canvas.height = video.videoHeight;
      //   video.play();
      //   detectVideo(video, canvas);
      //   resolve(true);
      // };
      video.addEventListener("canplaythrough", async () => {
        console.log("video canplaythrough");
        // 设置canvas的宽高和视频一致
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        cImgUrl.value = await getImgUrl(cImg);
        detectVideo(video, canvas);
        resolve(true);
      });
    });
  }
  // face-api
  async function setupFaceAPI() {
    await faceapi.nets.ssdMobilenetv1.load(modelPath);
    await faceapi.nets.ageGenderNet.load(modelPath);
    await faceapi.nets.faceLandmark68Net.load(modelPath);
    await faceapi.nets.faceRecognitionNet.load(modelPath);
    await faceapi.nets.faceExpressionNet.load(modelPath);
    optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({
      minConfidence: minScore,
      maxResults,
    });
  }
  async function run() {
    await faceapi.tf.setBackend("webgl");
    await faceapi.tf.ready();
    // tfjs optimizations
    if (faceapi.tf?.env().flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY)
      faceapi.tf.env().set("CANVAS2D_WILL_READ_FREQUENTLY", true);
    if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV)
      faceapi.tf.env().set("WEBGL_EXP_CONV", true);
    if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV)
      faceapi.tf.env().set("WEBGL_EXP_CONV", true);
    await setupFaceAPI();
    await setupCamera();
  }
  return {
    run,
  };
}
