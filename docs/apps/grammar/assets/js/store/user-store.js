import {
    STORE_USERS, STORE_WORDS, STORE_SETTINGS, STORE_NOTES,
    put, get, getAll, remove, getAllByIndex, removeByIndex, clearStore
} from './db.js'
import { userId as genUserId } from '../utils/id.js'
import { nowIso } from '../utils/date.js'

export async function listUsers() {
    const all = await getAll(STORE_USERS)
    return all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

export async function getUser(id) {
    if (!id) return null
    return get(STORE_USERS, id)
}

export async function createUser(name) {
    const t = nowIso()
    const user = {
        id: genUserId(),
        name: String(name || '').trim() || '未命名用户',
        createdAt: t,
        updatedAt: t
    }
    await put(STORE_USERS, user)
    return user
}

export async function saveUser(user) {
    const next = { ...user, updatedAt: nowIso() }
    await put(STORE_USERS, next)
    return next
}

export async function deleteUser(id) {
    if (!id) return
    await remove(STORE_USERS, id)
    await remove(STORE_SETTINGS, id)
    await removeByIndex(STORE_NOTES, 'userId', id)
    const words = await getAllByIndex(STORE_WORDS, 'userId', id)
    // 逐条删除；数据量在几千级，逐个删除可接受
    for (const w of words) {
        await remove(STORE_WORDS, w.id)
    }
}

export { clearStore }
