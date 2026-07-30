import TopBar from '../components/TopBar'
import { useAuth } from '../contexts/AuthContext'

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const name = user?.isAnonymous ? '게스트' : profile?.name

  return (
    <>
      <TopBar />
      <main className="page">
        <h1>대시보드</h1>
        <div className="empty">
          {name}님, 환영합니다! 🎉
          <br />
          프로젝트 카드는 다음 단계(Phase 2)에서 이 자리에 표시됩니다.
        </div>
      </main>
    </>
  )
}
