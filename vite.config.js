/*
 * @Author: 阿宇 969718197@qq.com
 * @Date: 2024-10-16 18:19:01
 * @LastEditors: 阿宇 969718197@qq.com
 * @LastEditTime: 2024-11-14 17:45:21
 * @Description: 
 */
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import rawPlugin from "vite-plugin-raw";
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  // base: '/ar-try',
  // server: {
  //   https: true
  // },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith("a-"),
        },
      },
    }),
    basicSsl(),
    rawPlugin({
      match: /\.(obj|mtl)$/,
    }),
  ],
  server: {
    port: 3100,
  }
});
