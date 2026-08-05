import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { countOwnedProjects, deleteUserFully, setUserPassword } from '../lib/adminUsers'
import { validatePassword } from '../lib/validators'
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

  /** 회원 비밀번호 재설정 (분실 대응) */
  const handleResetPassword = async (r: Row) => {
    setError('')
    const pw = prompt(
      `"${r.name || r.email}" 계정의 새 비밀번호를 입력하세요.\n` +
      `(영문 + 숫자 + 특수문자 포함 10자 이상)`,
    )
    if (pw === null) return
    const err = validatePassword(pw)
    if (err) { alert(err); return }

    try {
      await setUserPassword(r.uid, pw)
      alert(`비밀번호가 변경되었습니다.\n본인에게 새 비밀번호를 안전하게 전달하세요.`)
    } catch {
      setError('비밀번호 변경에 실패했습니다.')
    }
  }

  /** 회원 삭제 — 프로필·아이디 매핑·내 공간 데이터 정리 */
  const handleDelete = async (r: Row) => {
    setError('')
    const owned = await countOwnedProjects(r.uid)
    const warn = owned > 0
      ? `\n\n⚠ 이 회원이 소유한 프로젝트 ${owned}건은 삭제되지 않고 남습니다. (필요하면 마스터가 이어받아 관리하세요)`
      : ''
    if (!confirm(
      `"${r.name || r.email}" 계정을 완전히 삭제할까요?\n\n` +
      `· 로그인 계정, 프로필, 아이디(${r.name}), 개인 일정·Study가 모두 삭제됩니다.\n` +
      `· 삭제 후 같은 이메일로 다시 가입할 수 있습니다.\n` +
      `· 되돌릴 수 없습니다.${warn}`,
    )) return

    try {
      const { authDeleted } = await deleteUserFully(r.uid, r)
      alert(
        authDeleted
          ? '완전히 삭제되었습니다. 같은 이메일로 재가입할 수 있습니다.'
          : '대시보드 데이터는 삭제했지만 로그인 계정은 남아 있습니다.\n' +
            '터미널에서 다음을 실행하세요:\n' +
            `npm run delete-account -- "${r.email}" --prod`,
      )
    } catch {
      setError('삭제에 실패했습니다.')
    }
  }


  return (
    <>
      <TopBar />
      <main className="page">
        <h1>회원 관리</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: -10 }}>
          가입 승인(승인 대기 → 비회원 → 회원), 등급 변경, 비밀번호 재설정, 계정 비활성화·삭제를 할 수 있습니다.
          <br />
          <b>비회원</b>: 회사 프로젝트의 개요·일정/이슈·문서 조회 · <b>회원</b>: 여기에 장비·DB 설계·업데이트 이력까지
        </p>

        {rows.some((r) => r.role === 'pending') && (
          <div className="msg msg-ok">
            🔔 승인 대기 중인 가입자가 {rows.filter((r) => r.role === 'pending').length}명 있습니다.
          </div>
        )}

        {error && <div className="msg msg-error">{error}</div>}

        <section className="panel">
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th>아이디</th>
                  <th>이메일</th>
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
                      <td>
                        {isSelf ? (
                          ROLE_LABEL[r.role]
                        ) : (
                          <select
                            value={r.role}
                            onChange={(e) => changeRole(r.uid, e.target.value as Role)}
                          >
                            <option value="pending">승인 대기</option>
                            <option value="nonmember">비회원</option>
                            <option value="personal">회원</option>
                            <option value="master">마스터</option>
                            <option value="guest">게스트</option>
                          </select>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.disabled ? '🚫 비활성화' : r.role === 'pending' ? '⏳ 승인 대기' : '정상'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {!isSelf && r.role === 'pending' && (
                          <button className="btn btn-sm btn-primary" onClick={() => changeRole(r.uid, 'nonmember')}>
                            ✓ 승인 (비회원으로)
                          </button>
                        )}{' '}
                        {!isSelf && r.role === 'nonmember' && (
                          <button className="btn btn-sm btn-primary" onClick={() => changeRole(r.uid, 'personal')}>
                            ↑ 회원으로
                          </button>
                        )}{' '}
                        {!isSelf && (
                          <>
                            <button className="btn btn-sm btn-ghost" onClick={() => handleResetPassword(r)}>
                              비밀번호 변경
                            </button>{' '}
                            <button
                              className={`btn btn-sm ${r.disabled ? 'btn-ghost' : 'btn-danger'}`}
                              onClick={() => toggleDisabled(r.uid, !r.disabled)}
                            >
                              {r.disabled ? '활성화' : '비활성화'}
                            </button>{' '}
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r)}>
                              계정 삭제
                            </button>
                          </>
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
