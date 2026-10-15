/**
 * 复习队列构建与结果记录
 *
 * 队列策略（reviewOrder）：
 *   - mastery-asc  ：掌握度低优先，同掌握度按 lastReviewedAt 升序（最久未复习优先）
 *   - added-desc   ：最新添加优先
 *   - random       ：随机
 */

import { listByLanguage } from '../store/word-store.js'
import { recordReview } from '../store/word-store.js'

export const REVIEW_ORDERS = [
    { value: 'mastery-asc', label: '掌握度低优先' },
    { value: 'added-desc',  label: '最新添加优先' },
    { value: 'random',      label: '随机' }
]

export async function buildQueue(userId, language, options = {}) {
    const {
        order = 'mastery-asc',
        limit = 0,
        dueOnly = false
    } = options

    let all = await listByLanguage(userId, language)

    if (dueOnly) {
        const t = new Date().toISOString()
        all = all.filter((w) => !w.nextReviewAt || String(w.nextReviewAt) <= t)
    }

    switch (order) {
        case 'added-desc':
            all.sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)))
            break
        case 'random':
            shuffle(all)
            break
        case 'mastery-asc':
        default:
            all.sort((a, b) => {
                const m = (a.mastery || 0) - (b.mastery || 0)
                if (m !== 0) return m
                return String(a.lastReviewedAt || '').localeCompare(String(b.lastReviewedAt || ''))
            })
            break
    }

    if (limit > 0) all = all.slice(0, limit)
    return all
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
}

export async function answer(wordId, correct) {
    return recordReview(wordId, { correct })
}

/** 会话统计 */
export function createSessionStats(queue) {
    return {
        total: queue.length,
        done: 0,
        correct: 0,
        wrong: 0,
        startedAt: Date.now(),
        get progress() {
            return this.total === 0 ? 0 : this.done / this.total
        },
        get accuracy() {
            return this.done === 0 ? 0 : this.correct / this.done
        },
        record(ok) {
            this.done += 1
            if (ok) this.correct += 1
            else this.wrong += 1
        }
    }
}
