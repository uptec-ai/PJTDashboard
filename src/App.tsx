import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import FindIdPage from './pages/FindIdPage'
import DashboardPage from './pages/DashboardPage'

// 무거운 화면(캘린더·다이어그램 등)은 실제로 열 때만 내려받는다 — 첫 로딩 속도 최적화
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'))
const MyCalendarPage = lazy(() => import('./pages/MyCalendarPage'))
const MyStudyPage = lazy(() => import('./pages/MyStudyPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))

function Loading() {
  return <div className="center-page muted">불러오는 중…</div>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* 공개 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/find-id" element={<FindIdPage />} />

            {/* 로그인 필요 */}
            <Route
              path="/"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <RequireAuth>
                  <ProjectDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/my/calendar"
              element={
                <RequireAuth noGuest>
                  <MyCalendarPage />
                </RequireAuth>
              }
            />
            <Route
              path="/my/study"
              element={
                <RequireAuth noGuest>
                  <MyStudyPage />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth noGuest>
                  <AccountPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAuth roles={['master']}>
                  <AdminUsersPage />
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
