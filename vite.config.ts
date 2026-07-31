import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // 에뮬레이터 데이터 내보내기 폴더는 감시 제외 (감시 중이면 백업 rename이 EPERM으로 실패)
      ignored: ['**/.emulator-data/**', '**/firebase-export-*/**', '**/.tools/**'],
    },
  },
})
