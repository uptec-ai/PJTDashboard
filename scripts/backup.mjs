/**
 * 에뮬레이터 데이터 백업 래퍼
 *
 * firebase emulators:export는 임시 폴더(firebase-export-*)에 내보낸 뒤 .emulator-data로
 * 이름을 바꾸는데, Windows에서 이 rename이 EPERM으로 실패하는 경우가 있다(파일 감시/백신).
 * 실패해도 내보내기 자체는 완료되므로, 여기서 이름 변경을 직접 마무리한다.
 */
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const target = join(root, '.emulator-data')

try {
  execSync('firebase emulators:export ./.emulator-data --force --project demo-gcs-dashboard', {
    cwd: root,
    stdio: 'pipe', // 실패해도 아래에서 복구하므로 에러 출력은 숨김
  })
} catch {
  // rename 단계 실패 가능 — 아래에서 수동 마무리
}

const temps = readdirSync(root).filter(
  (d) => d.startsWith('firebase-export-') && existsSync(join(root, d, 'firebase-export-metadata.json')),
)

if (temps.length > 0) {
  const newest = temps.sort().pop()
  rmSync(target, { recursive: true, force: true })
  renameSync(join(root, newest), target)
  for (const t of temps) {
    if (t !== newest && existsSync(join(root, t))) rmSync(join(root, t), { recursive: true, force: true })
  }
}

if (existsSync(join(target, 'firebase-export-metadata.json'))) {
  console.log('✔ 백업 완료: .emulator-data (다음 에뮬레이터 실행 시 자동 복원)')
} else {
  console.error('✖ 백업 실패 — 에뮬레이터가 켜져 있는지 확인하세요 (npm run emulators)')
  process.exit(1)
}
