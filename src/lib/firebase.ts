import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

// 개발 중에는 로컬 에뮬레이터(가짜 Firebase)에 연결한다.
// 실서버 배포 시 .env 에 VITE_FB_* 값을 넣으면 그대로 실제 Firebase로 전환된다.
const useEmulators =
  import.meta.env.DEV && import.meta.env.VITE_FB_API_KEY === undefined

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN ?? 'demo-gcs-dashboard.firebaseapp.com',
  projectId: import.meta.env.VITE_FB_PROJECT_ID ?? 'demo-gcs-dashboard',
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET ?? 'demo-gcs-dashboard.appspot.com',
  appId: import.meta.env.VITE_FB_APP_ID ?? 'demo-app-id',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

auth.languageCode = 'ko'

if (useEmulators) {
  // 같은 wifi의 다른 PC에서 접속해도 동작하도록, 브라우저 주소창의 호스트를 그대로 사용
  // (localhost로 열면 localhost, 192.168.x.x로 열면 그 IP의 에뮬레이터로 연결)
  const emuHost = window.location.hostname || '127.0.0.1'
  connectAuthEmulator(auth, `http://${emuHost}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, emuHost, 8080)
  connectStorageEmulator(storage, emuHost, 9199)
}
