/*
 * @Author: 阿宇 969718197@qq.com
 * @Date: 2024-10-21 09:15:30
 * @LastEditors: 阿宇 969718197@qq.com
 * @LastEditTime: 2024-10-25 15:51:46
 * @Description:
 */
import * as THREE from "three";
// 加载获取图片
export async function loadGetImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

//像素点坐标系转化
export function convertPixelToCoordinates(x, y, camera, renderer) {
  // 创建一个vec3对象来接收坐标
  var vector = new THREE.Vector3();
  // 将2D屏幕上的点转换为标准设备坐标(-1到+1)
  vector.set(
    (x / renderer.domElement.clientWidth) * 2 - 1,
    -(y / renderer.domElement.clientHeight) * 2 + 1,
    0.5 // 这个z值将转换为从相机的近剪裁面开始
  );
  // 将标准设备坐标转换为世界坐标
  vector.unproject(camera);
  return vector;
}
// 像素大小转化为世界大小
export function pixelToWorldSize(width, height, camera, renderer) {
  const canvasWidth = renderer.domElement.clientWidth;
  const canvasHeight = renderer.domElement.clientHeight;
  const distance = camera.position.z; // 假设相机到平面的距离为相机的z坐标
  const fov = camera.fov * (Math.PI / 180); // 将视角从度数转换为弧度
  const worldHeight = 2 * Math.tan(fov / 2) * distance; // 计算给定距离下的视锥高度
  const worldWidth = worldHeight * (canvasWidth / canvasHeight); // 根据宽高比计算视锥宽度
  // 像素到世界单位的转换
  const pixelToWorldRatio = worldWidth / canvasWidth;
  const planeWidth = width * pixelToWorldRatio;
  const planeHeight = height * pixelToWorldRatio;
  return { width: planeWidth, height: planeHeight };
}

//删除网格
export function removeMeshByName(scene, meshName) {
  scene.traverse((object) => {
    if (object.isMesh && object.name === meshName) {
      // 释放材质和几何体
      if (object.material) {
        object.material.dispose();
      }
      if (object.geometry) {
        object.geometry.dispose();
      }
      // 从场景中移除该对象
      scene.remove(object);
    }
  });
}

// 判断网格是否存在场景中
export function isMeshExist(scene, meshName) {
  let isExist = false;
  scene.traverse((object) => {
    if (object.isMesh && object.name === meshName) {
      isExist = true;
    }
  });
  return isExist;
}

export function pixelToSceneCoords(pixelX, pixelY, camera, canvas, scene) {
  // 获取屏幕的宽高
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // 将像素坐标转换为归一化设备坐标 (NDC)
  const ndcX = (pixelX / width) * 2 - 1;
  const ndcY = -(pixelY / height) * 2 + 1; // Y 轴方向需要反转

  // 创建射线投射器
  const raycaster = new THREE.Raycaster();

  // 设置射线从相机的位置，穿过屏幕的 NDC 坐标
  const mouseVector = new THREE.Vector2(ndcX, ndcY);
  raycaster.setFromCamera(mouseVector, camera);

  // 射线与场景中的对象相交
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    // 返回最近的交点坐标（场景坐标）
    return intersects[0].point;
  } else {
    // 如果没有相交的物体，可以选择返回一个默认的远距离坐标，或是将其投射到平面上
    return null;
  }
}

export function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        // texture.magFilter = THREE.LinearFilter;
        // texture.minFilter = THREE.LinearFilter;
        // texture.format = THREE.RGBAFormat;
        resolve(texture); // 纹理加载成功，返回纹理对象
      },
      undefined,
      (error) => {
        reject(error); // 纹理加载失败，返回错误
      }
    );
  });
}

