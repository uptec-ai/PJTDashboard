import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'
import { ROLE_LABEL } from '../types'
import type { Role, UserProfile } from '../types'

interface Row extends UserProfile {
  uid: string
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snap) => setRows(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as UserProfile) }))),
      () => setError('회원 목록을 불러오지 못했습니다.'),
    )
  }, [])

  const changeRole = async (uid: string, role: Role) => {
    setError('')
    try {
      await updateDoc(doc(db, 'users', uid), { role })
    } catch {
      setError('등급 변경에 실패했습니다.')
    }
  }

  const toggleDisabled = async (uid: string, disabled: boolean) => {
    setError('')
    try {
      await updateDoc(doc(db, 'users', uid), { disabled })
    } catch {
      setError('상태 변경에 실패했습니다.')
    }
  }

  const formatPhone = (p: string) =>
    p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p || '—'

  return (
    <>
      <TopBar />
      <main className="page">
        <h1>회원 관리</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: -10 }}>
          등급 변경과 계정 비활성화(로그인 차단)를 할 수 있습니다.
        </p>

        {error && <div className="msg msg-error">{error}</div>}

        <section className="panel">
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th>아이디</th>
                  <th>이메일</th>
                  <th>휴대폰</th>
                  <th>등급</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSelf = r.uid === user?.uid
                  return (
                    <tr key={r.uid}>
                      <td>{r.name || '—'}</td>
                      <td>{r.email || '(게스트)'}</td>
                      <td>{formatPhone(r.phone)}</td>
                      <td>
                        {isSelf ? (
                          ROLE_LABEL[r.role]
                        ) : (
                          <select
                            value={r.role}
                            onChange={(e) => changeRole(r.uid, e.target.value as Role)}
                          >
                            <option value="guest">게스트</option>
                            <option value="personal">개인</option>
                            <option value="master">마스터</option>
                          </select>
                        )}
                      </td>
                      <td>{r.disabled ? '🚫 비활성화' : '정상'}</td>
                      <td>
                        {!isSelf && (
                          <button
                            className={`btn btn-sm ${r.disabled ? 'btn-ghost' : 'btn-danger'}`}
                            onClick={() => toggleDisabled(r.uid, !r.disabled)}
                          >
                            {r.disabled ? '활성화' : '비활성화'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <div className="empty">가입한 회원이 없습니다.</div>}
        </section>
      </main>
    </>
  )
}
