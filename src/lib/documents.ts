import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { deleteObject, getBlob, ref, updateMetadata, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase'
import { diffCounts, diffLines } from './diff'
import type { DocumentVersionRow } from '../types'

/** 본문을 Firestore에 저장하는 텍스트 계열 확장자 (보기·diff 지원) */
const TEXT_EXTS = ['md', 'txt', 'log', 'csv', 'json']
const MAX_TEXT_BYTES = 900_000 // Firestore 문서 1MiB 제한 고려

export function fileExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export function isTextDoc(fileName: string): boolean {
  return TEXT_EXTS.includes(fileExt(fileName))
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/**
 * 문서 업로드 — 같은 이름의 기존 버전들이 있으면 다음 버전 번호를 부여하고,
 * 텍스트 문서면 이전 최신 버전과의 diff(추가/삭제 줄 수)를 함께 기록한다.
 */
export async function uploadDocument(
  pid: string,
  name: string,
  file: File,
  existing: DocumentVersionRow[], // 해당 프로젝트의 전체 문서 버전 목록
  isPublic = false, // 게스트 공개 여부 (기본 비공개)
) {
  const sameName = existing.filter((d) => d.name === name)
  const version = sameName.length === 0 ? 1 : Math.max(...sameName.map((d) => d.version)) + 1
  const prev = sameName.sort((x, y) => y.version - x.version)[0] ?? null

  // 텍스트 본문 추출 (md/txt 계열, 크기 제한 내)
  let textContent: string | null = null
  if (isTextDoc(file.name) && file.size <= MAX_TEXT_BYTES) {
    textContent = await file.text()
  }

  // 이전 버전과 diff 요약
  let diffAdded: number | null = null
  let diffRemoved: number | null = null
  if (textContent !== null && prev?.textContent != null) {
    const counts = diffCounts(diffLines(prev.textContent, textContent))
    diffAdded = counts.added
    diffRemoved = counts.removed
  }

  // 1) Firestore 메타 문서 생성 (id 확보)
  const metaRef = await addDoc(collection(db, 'projects', pid, 'documents'), {
    name,
    version,
    fileName: file.name,
    storagePath: '', // 업로드 후 채움
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    source: 'user',
    isPublic,
    textContent,
    diffAdded,
    diffRemoved,
    createdAt: serverTimestamp(),
  })

  // 2) Storage(GCS) 업로드: projects/{pid}/docs/{docId}/v{n}_{파일명}
  const storagePath = `projects/${pid}/docs/${metaRef.id}/v${version}_${file.name}`
  try {
    await uploadBytes(ref(storage, storagePath), file, {
      contentType: file.type || 'application/octet-stream',
      // Storage 보안 규칙이 게스트 다운로드 허용 판단에 사용
      customMetadata: { public: String(isPublic) },
    })
  } catch (e) {
    await deleteDoc(metaRef) // 업로드 실패 시 메타 정리
    throw e
  }

  // 3) 경로 확정
  const { updateDoc } = await import('firebase/firestore')
  await updateDoc(doc(db, 'projects', pid, 'documents', metaRef.id), { storagePath })
}

/** 문서 게스트 공개 토글 — Firestore 플래그 + Storage 메타데이터 동시 갱신 */
export async function setDocumentPublic(pid: string, row: DocumentVersionRow, isPublic: boolean) {
  const { updateDoc: upd } = await import('firebase/firestore')
  await upd(doc(db, 'projects', pid, 'documents', row.id), { isPublic })
  if (row.storagePath) {
    await updateMetadata(ref(storage, row.storagePath), {
      customMetadata: { public: String(isPublic) },
    }).catch(() => {})
  }
}

export async function deleteDocumentVersion(pid: string, row: DocumentVersionRow) {
  if (row.storagePath) {
    await deleteObject(ref(storage, row.storagePath)).catch(() => {}) // 파일이 없어도 메타는 지운다
  }
  await deleteDoc(doc(db, 'projects', pid, 'documents', row.id))
}

/** 파일 다운로드 — Blob으로 받아 원본 파일명으로 저장 */
export async function downloadDocument(row: DocumentVersionRow) {
  const blob = await getBlob(ref(storage, row.storagePath))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = row.fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** 미리보기용 Blob URL (PDF 등) — 사용 후 revoke 필요 */
export async function getPreviewUrl(row: DocumentVersionRow): Promise<string> {
  const blob = await getBlob(ref(storage, row.storagePath))
  return URL.createObjectURL(new Blob([blob], { type: row.contentType }))
}
