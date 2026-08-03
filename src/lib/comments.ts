import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Comment } from '../types'

export async function addComment(pid: string, data: Omit<Comment, 'acked' | 'createdAt'>) {
  await addDoc(collection(db, 'projects', pid, 'comments'), {
    ...data,
    text: data.text.slice(0, 1000),
    author: data.author.slice(0, 30),
    acked: false,
    createdAt: serverTimestamp(),
  })
}

export async function setCommentAcked(pid: string, id: string, acked: boolean) {
  await updateDoc(doc(db, 'projects', pid, 'comments', id), { acked })
}

export async function deleteComment(pid: string, id: string) {
  await deleteDoc(doc(db, 'projects', pid, 'comments', id))
}
