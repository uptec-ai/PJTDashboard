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
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}
