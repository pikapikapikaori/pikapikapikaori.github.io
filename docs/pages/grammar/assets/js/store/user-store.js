import {
    STORE_USERS, STORE_WORDS, STORE_SETTINGS,
    put, get, getAll, remove, getAllByIndex, clearStore
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
    const words = await getAllByIndex(STORE_WORDS, 'userId', id)
    // 逐条删除；数据量在几千级，逐个删除可接受
    for (const w of words) {
        await remove(STORE_WORDS, w.id)
    }
}

/** 清空某个用户的所有数据（用户本身也删除） */
export async function purgeUser(id) {
    await deleteUser(id)
}

/** 用户词条数统计 */
export async function countWords(id) {
    const list = await getAllByIndex(STORE_WORDS, 'userId', id)
    return list.length
}

/** 内部：仅清空 settings（保留用户） */
export async function clearUserSettings(id) {
    if (!id) return
    await remove(STORE_SETTINGS, id)
}

export { clearStore }
