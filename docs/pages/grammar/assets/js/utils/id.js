/** id 生成：用户 `u_xxx`，词条 `w_xxx` */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function randomChunk(len = 10) {
    let s = ''
    const bytes = new Uint8Array(len);
    (crypto || window.crypto).getRandomValues(bytes)
    for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
    return s
}

export function uid(prefix = '') {
    const chunk = randomChunk(10)
    return prefix ? `${prefix}_${chunk}` : chunk
}

export function userId() { return uid('u') }
export function wordId() { return uid('w') }
