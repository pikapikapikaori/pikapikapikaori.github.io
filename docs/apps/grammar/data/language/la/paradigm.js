
const BREVE = '\u0306'
const MACRON = '\u0304'

const VOWELS = 'aeiouyAEIOUY'
const DIPHTHONGS = new Set(['ae', 'oe', 'au', 'eu', 'ei', 'ou', 'AE', 'OE', 'AU', 'EU', 'EI', 'OU'])

function toClusters(text) {
    const out = []
    for (const ch of text) {
        if (/\p{M}/u.test(ch) && out.length) out[out.length - 1].marks += ch
        else out.push({ base: ch, marks: '' })
    }
    return out
}

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

function isConsonantal(clusters, index) {
    const base = clusters[index].base.toLowerCase()
    const prev = clusters[index - 1]?.base.toLowerCase() || ''
    const next = clusters[index + 1]?.base.toLowerCase() || ''
    if (base === 'u' && (prev === 'q' || (prev === 'g' && VOWELS.includes(next)))) return true
    if (base === 'i' && VOWELS.includes(next) && (!prev || VOWELS.includes(prev))) return true
    return false
}
