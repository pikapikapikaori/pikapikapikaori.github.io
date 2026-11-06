/**
 * 拉丁语的「文字档案」补充：保存时的规范化。
 *
 * 拉丁语**单元音默认短**：a e i o u y 只要不在双元音里、也没标长音符，就补上短音符 ˘
 * （显示时默认藏着，需要时用 Ă 按钮切出来）。双元音 ae oe au eu ei ou 里的元音不补。
 * 长音符（ā ē ī ō ū）保持原样，仍与短音 / 无标音区分。
 */

const BREVE = '\u0306'
const MACRON = '\u0304'

const VOWELS = 'aeiouyAEIOUY'
/** 双元音（两个元音连写） */
const DIPHTHONGS = new Set(['ae', 'oe', 'au', 'eu', 'ei', 'ou', 'AE', 'OE', 'AU', 'EU', 'EI', 'OU'])

/** 按「基字 + 组合符」切成簇 */
function toClusters(text) {
    const out = []
    for (const ch of text) {
        if (/\p{M}/u.test(ch) && out.length) out[out.length - 1].marks += ch
        else out.push({ base: ch, marks: '' })
    }
    return out
}

/**
 * @param {string} text
 * @returns {string} 单元音补上短音符之后的写法
 */
export function canonicalize(text) {
    const src = String(text ?? '')
    if (!src) return src
    const clusters = toClusters(src.normalize('NFD'))
    const inDiphthong = new Set()

    for (let i = 0; i < clusters.length - 1; i++) {
        if (!DIPHTHONGS.has(clusters[i].base + clusters[i + 1].base)) continue
        inDiphthong.add(i)
        inDiphthong.add(i + 1)
    }

    const out = clusters.map((cluster, index) => {
        const { base, marks } = cluster
        const keep = base + marks.split(BREVE).join('')
        if (!VOWELS.includes(base) || inDiphthong.has(index)) return keep
        if (marks.includes(MACRON)) return keep
        if (isConsonantal(clusters, index)) return keep
        return base + marks + (marks.includes(BREVE) ? '' : BREVE)
    })

    return out.join('').normalize('NFC')
}

/** i / u 在拉丁语里有时是半元音（iam 的 i、quis 的 u），这种不标长度 */
function isConsonantal(clusters, index) {
    const base = clusters[index].base.toLowerCase()
    const prev = clusters[index - 1]?.base.toLowerCase() || ''
    const next = clusters[index + 1]?.base.toLowerCase() || ''
    // qu 里的 u、gu + 元音里的 u
    if (base === 'u' && (prev === 'q' || (prev === 'g' && VOWELS.includes(next)))) return true
    // 词首或两个元音之间的 i（iam、eius）
    if (base === 'i' && VOWELS.includes(next) && (!prev || VOWELS.includes(prev))) return true
    return false
}
