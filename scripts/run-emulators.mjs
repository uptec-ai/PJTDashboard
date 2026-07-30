/**
 * Firebase 에뮬레이터 실행 래퍼
 *
 * firebase-tools는 Java 21+가 필요하다. PC에 설치된 Java 버전과 무관하게
 * 프로젝트 내 포터블 JRE(.tools/jdk-*-jre)를 PATH 앞에 붙여 실행한다.
 */
import { spawn } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const toolsDir = join(root, '.tools')

let javaBin = null
if (existsSync(toolsDir)) {
  const jre = readdirSync(toolsDir).find((d) => /jdk-.*jre/i.test(d) || /jre/i.test(d))
  if (jre) javaBin = join(toolsDir, jre, 'bin')
}

if (!javaBin || !existsSync(javaBin)) {
  console.error('✖ 프로젝트 포터블 Java(.tools/jdk-*-jre)를 찾을 수 없습니다.')
  console.error('  README의 "실행 방법"을 참고해 JRE 21을 .tools 폴더에 준비하세요.')
  process.exit(1)
}

const env = {
  ...process.env,
  PATH: `${javaBin};${process.env.PATH}`,
  JAVA_HOME: resolve(javaBin, '..'),
}

const args = [
  'emulators:start',
  '--project', 'demo-gcs-dashboard',
  '--import=./.emulator-data',
  '--export-on-exit',
]

const child = spawn('firebase', args, {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: true, // Windows에서 firebase.cmd 실행
})

child.on('exit', (code) => process.exit(code ?? 0))
