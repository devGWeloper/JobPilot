import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  clearScreen: false,
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
