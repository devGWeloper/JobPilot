import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  // svelteTesting()는 process.env.VITEST가 있을 때만 동작해 dev/build/tauri에는
  // 영향이 없다. vite-plugin-svelte가 기본적으로 컴포넌트를 서버(SSR) 모드로
  // 컴파일해 테스트에서 mount()가 "not available on the server"로 죽는 문제를,
  // resolve.conditions에 'browser'를 끼워 넣어 막아준다.
  plugins: [tailwindcss(), svelte(), svelteTesting({ autoCleanup: false, noExternal: false })],
  clearScreen: false,
  resolve: {
    alias: {
      // Windows에서 URL.pathname은 "/C:/..." 형태라 그대로 쓰면 경로가 깨진다.
      // fileURLToPath가 플랫폼에 맞는 경로로 바꿔준다.
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    // jsdom이어야 한다. 'node'로 두면 @sveltejs/vite-plugin-svelte가
    // .svelte.ts의 룬을 SSR 모드로 컴파일하는데, 그 모드에서는 $state()가
    // 사실상 no-op이고 $state.snapshot()이 독립된 복사본을 만들지 못한다.
    // 스토어의 롤백 로직이 조용히 무력화되므로 DOM 환경이 필요하다.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
