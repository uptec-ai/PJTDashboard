import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'
import { ROLE_LABEL } from '../types'
import { validatePassword } from '../lib/validators'

export default function AccountPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  // 비밀번호 변경
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  // 회원 탈퇴
  const [delPw, setDelPw] = useState('')
  const [delError, setDelError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const reauth = async (pw: string) => {
    const cred = EmailAuthProvider.credential(user.email!, pw)
    await reauthenticateWithCredential(user, cred)
  }

  const handleChangePw = async (e: FormEvent) => {
    e.preventDefault()
    setPwMsg('')
    setPwError('')

    const err = validatePassword(newPw)
    if (err) return setPwError(err)
    if (newPw !== newPw2) return setPwError('새 비밀번호가 서로 일치하지 않습니다.')

    setBusy(true)
    try {
      await reauth(curPw)
      await updatePassword(user, newPw)
      setPwMsg('비밀번호가 변경되었습니다.')
      setCurPw('')
      setNewPw('')
      setNewPw2('')
    } catch {
      setPwError('현재 비밀번호가 올바르지 않습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setDelError('')
    if (!confirm('정말 탈퇴하시겠습니까? 계정 정보가 삭제됩니다.')) return

    setBusy(true)
    try {
      await reauth(delPw)
      // 프로필/ID찾기 문서 정리 후 계정 삭제
      if (profile?.phone) {
        await deleteDoc(doc(db, 'emailLookup', profile.phone)).catch(() => {})
      }
      await deleteDoc(doc(db, 'users', user.uid)).catch(() => {})
      await deleteUser(user)
      navigate('/login')
    } catch {
      setDelError('비밀번호가 올바르지 않거나 탈퇴에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const formatPhone = (p: string) =>
    p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p

  return (
    <>
      <TopBar />
      <main className="page">
        <h1>내 정보</h1>

        <section className="panel">
          <h3>프로필</h3>
          <div className="table-wrap">
            <table className="list">
              <tbody>
                <tr><td>이름</td><td>{profile?.name}</td></tr>
                <tr><td>아이디 (이메일)</td><td>{profile?.email}</td></tr>
                <tr><td>휴대폰</td><td>{profile ? formatPhone(profile.phone) : ''}</td></tr>
                <tr><td>등급</td><td>{profile ? ROLE_LABEL[profile.role] : ''}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h3>비밀번호 변경</h3>
          <form onSubmit={handleChangePw} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
            <div className="field">
              <label htmlFor="ac-cur">현재 비밀번호</label>
              <input id="ac-cur" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" required />
            </div>
            <div className="field">
              <label htmlFor="ac-new">새 비밀번호</label>
              <input id="ac-new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required />
              <span className="hint">영문 + 숫자 + 특수문자 포함 10자 이상</span>
            </div>
            <div className="field">
              <label htmlFor="ac-new2">새 비밀번호 확인</label>
              <input id="ac-new2" type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" required />
            </div>
            {pwMsg && <div className="msg msg-ok">{pwMsg}</div>}
            {pwError && <div className="msg msg-error">{pwError}</div>}
            <button className="btn btn-primary" disabled={busy} style={{ width: 'auto', alignSelf: 'flex-start' }}>변경하기</button>
          </form>
        </section>

        <section className="panel">
          <h3>회원 탈퇴</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            탈퇴하면 계정과 프로필 정보가 삭제됩니다. 확인을 위해 비밀번호를 입력하세요.
          </p>
          <div style={{ display: 'flex', gap: 10, maxWidth: 380 }}>
            <input
              type="password"
              value={delPw}
              onChange={(e) => setDelPw(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              style={{
                flex: 1, border: '1px solid var(--grid)', borderRadius: 8,
                padding: '8px 12px', fontSize: 14, fontFamily: 'inherit',
                background: 'var(--plane)', color: 'var(--ink)',
              }}
            />
            <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={busy || !delPw}>
              탈퇴하기
            </button>
          </div>
          {delError && <div className="msg msg-error" style={{ maxWidth: 380 }}>{delError}</div>}
        </section>
      </main>
    </>
  )
}
