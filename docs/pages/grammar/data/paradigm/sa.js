/**
 * 梵语专用的后期处理：连声（sandhi）与重音（svara）。
 *
 * 通用部分（toUnits / fromUnits）在 models/paradigm-generate.js 里，
 * 这里只放梵语的音系规则。
 */
import { toUnits, fromUnits, ACUTE, CIRCUMFLEX } from '../../assets/js/models/paradigm-generate.js'

export const accentModes = ['sa', 'sa-vedic']


const SA_VOWEL = 'aāiīuūṛ'
const SA_ACCENTED = 'āīūṛ'
const SVARITA = '\u0302'
const ANUDATTA = '\u0331'

/** 词尾弱化：浊 / 送气 → 同部位清不送气；咝音与 r → visarga；m → anusvāra */
const SA_FINAL = {
    g: 'k', gh: 'k', k: 'k', kh: 'k',
    j: 'k', jh: 'k', c: 'k', ch: 'k', ñ: 'ṅ',
    ḍ: 'ṭ', ḍh: 'ṭ', ṭ: 'ṭ', ṭh: 'ṭ',
    d: 't', dh: 't', t: 't', th: 't',
    b: 'p', bh: 'p', p: 'p', ph: 'p',
    ś: 'ḥ', ṣ: 'ḥ', s: 'ḥ', r: 'ḥ', ḥ: 'ḥ',
    m: 'ṃ', ṃ: 'ṃ',
}

/**
 * 词内连声：把左段末尾与右段开头按梵语规则合并
 * 只处理最常见的一组（元音连声 + 唇 / 齿鼻音不变），其余原样拼接。
 */
function saJoin(left, right) {
    const L = String(left ?? '')
    const R = String(right ?? '')
    if (!L || !R) return L + R

    const l = L.slice(-1)
    const r = R[0]
    const rest = R.slice(1)

    // 双元音：a/ā + e/ai / o/au
    const diph = R.slice(0, 2)
    if ('aā'.includes(l) && (diph === 'ai' || diph === 'au')) {
        return L.slice(0, -1) + diph + R.slice(2)
    }

    if (SA_VOWEL.includes(l) && (SA_VOWEL + 'eo').includes(r)) {
        const aGrade = 'aā'
        if (aGrade.includes(l)) {
            if (aGrade.includes(r)) return L.slice(0, -1) + 'ā' + rest
            if ('iī'.includes(r)) return L.slice(0, -1) + 'e' + rest
            if ('uū'.includes(r)) return L.slice(0, -1) + 'o' + rest
            if (r === 'ṛ') return L.slice(0, -1) + 'ar' + rest
            // 词干尾 a + 词尾 e / o：梵语词内形态变化（bhava + e → bhave）
            if (r === 'e' || r === 'o') return L.slice(0, -1) + r + rest
        }
        if ('iī'.includes(l)) {
            if ('iī'.includes(r)) return L.slice(0, -1) + 'ī' + rest
            // i / ī 变成半元音 y（不是「保留 i 再加 y」）
            return L.slice(0, -1) + 'y' + R
        }
        if ('uū'.includes(l)) {
            if ('uū'.includes(r)) return L.slice(0, -1) + 'ū' + rest
            return L.slice(0, -1) + 'v' + R
        }
        if (l === 'ṛ') return L.slice(0, -1) + 'r' + R
    }
    // 清塞音 + 浊送气（bhavat + bhyām → bhavadbhyām）、d + s → ts（vidvad + su → vidvatsu）
    if (l === 't' && R.startsWith('bh')) return L.slice(0, -1) + 'd' + R
    if (l === 'd' && R.startsWith('s')) return L.slice(0, -1) + 't' + R
    // dh + 词尾：ruṇadh + si → ruṇatsi、ruṇadh + dhi → ruṇaddhi、ruṇadh + va → ruṇadva
    if (L.endsWith('dh')) {
        const head = L.slice(0, -2)
        if (R === 's') return head + 's'
        if (R === 't') return head + 't'
        if (R.startsWith('dhv')) return head + 'dhv' + R.slice(3)
        if (R.startsWith('dh')) return head + 'ddh' + R.slice(2)
        if (R.startsWith('s')) return head + 't' + R
        if (R.startsWith('t')) return head + 'ddh' + R.slice(1)
    }
    // ṣ + 塞音 / 咝音：dveṣ + si → dvekṣi、dviṣ + dhve → dviḍḍhve、dveṣ + s → dveṭ
    if (l === 'ṣ') {
        const head = L.slice(0, -1)
        if (R === 's') return head + 'ṭ'
        if (R === 't') return head + 'ṭ'
        if (R.startsWith('s')) return head + 'kṣ' + R.slice(1)
        if (R.startsWith('th')) return head + 'ṣṭh' + R.slice(2)
        if (R.startsWith('t')) return head + 'ṣṭ' + R.slice(1)
        if (R.startsWith('dh')) return head + 'ḍḍh' + R.slice(2)
    }
    return L + R
}

/** 词尾停顿式：把词末辅音按 padasandhi 弱化 */
function saWordFinal(text) {
    const s = String(text ?? '')
    if (!s) return s
    const last = s.slice(-1)
    const mapped = SA_FINAL[last]
    if (!mapped || mapped === last) return s
    return s.slice(0, -1) + mapped
}

/** 梵语重音：保持词干原有的锐重音；sa-vedic 另给 udātta 之后的音节补 svarita */
function applySaAccent(text, mode) {
    const s = String(text ?? '')
    if (!s || !mode || mode === 'none') return s
    if (mode !== 'sa-vedic') return s

    const units = toUnits(s)
    const vowels = []
    units.forEach((u, i) => {
        if (SA_VOWEL.includes(u.ch) || SA_ACCENTED.includes(u.ch)) vowels.push(i)
    })
    if (!vowels.length) return s

    let udatta = -1
    vowels.forEach((idx, k) => {
        if (units[idx].marks.includes(ACUTE)) udatta = k
    })
    if (udatta < 0 || udatta + 1 >= vowels.length) return s

    const next = units[vowels[udatta + 1]]
    if (next.marks.includes(ACUTE)) return s
    next.marks = next.marks.filter((m) => m !== CIRCUMFLEX && m !== ANUDATTA)
    next.marks.push(SVARITA)
    return fromUnits(units)
}

/** ---------------- 词干推导（生词表单 / 生成表格共用） ---------------- */

/** 元音 guṇa（a 不变；i/ī→e；u/ū→o；ṛ→ar；ḷ→al） */
const GUNA = { a: 'a', ā: 'ā', i: 'e', ī: 'e', u: 'o', ū: 'o', ṛ: 'ar', ṝ: 'ār', ḷ: 'al', ḹ: 'āl' }
const VOWEL_RE = /[aāiīuūṛṝḷḹEO]/

/** 找词根最后一个元音（前面是 head，后面是尾辅音） */
function lastVowel(root) {
    for (let i = root.length - 1; i >= 0; i--) {
        if (VOWEL_RE.test(root[i])) return { index: i, vowel: root[i], head: root.slice(0, i), tail: root.slice(i + 1) }
    }
    return null
}

/** 强词干用的 guṇa（a/ā 都取 ā，如 class2 √ad → ād） */
function gunaStrong(root) {
    const hit = lastVowel(root)
    if (!hit) return root
    const table = { a: 'ā', ā: 'ā', i: 'e', ī: 'e', u: 'o', ū: 'o', ṛ: 'ar', ṝ: 'ār', ḷ: 'al', ḹ: 'āl' }
    return hit.head + (table[hit.vowel] || hit.vowel) + hit.tail
}

/** guṇa 后的词干（元音结尾时按 ay / av 处理，如 nī → nay、bhū → bhav） */
function gunaStem(root) {
    const hit = lastVowel(root)
    if (!hit) return root
    const { vowel, head, tail } = hit
    if (tail) return head + (GUNA[vowel] || vowel) + tail
    if (vowel === 'i' || vowel === 'ī') return head + 'ay'
    if (vowel === 'u' || vowel === 'ū') return head + 'av'
    return head + (GUNA[vowel] || vowel)
}

/** 个别不规则词根：在这里兜底，用户也可以在补充词干里直接覆盖 */
const IRREGULAR = {
    // 第 1 类常见不规则
    'verb-class1': { gam: 'gaccha', i: 'e', prach: 'pṛccha', han: 'hana' }
}

function class1Present(root) {
    const fix = IRREGULAR['verb-class1'][root]
    if (fix) return fix
    return gunaStem(root) + 'a'
}

function class4Present(root) {
    return root + 'ya'
}

/** 叠音：首辅音 + 短元音复制到词根前（√hu → ju-hu；h → j） */
function reduplicate(root, grade) {
    const hit = lastVowel(root)
    if (!hit) return root
    const firstVowel = root.slice(0, hit.index + 1).match(/[aāiīuūṛṝḷḹ]/)
    const vowel = firstVowel ? firstVowel[0] : 'a'
    const dupVowel = ('uū'.includes(vowel) ? 'u' : ('iī'.includes(vowel) ? 'i' : 'a'))
    const cons = root.slice(0, root.indexOf(vowel)) || ''
    const mapped = cons ? cons.replace(/h$/, 'j').replace(/ṣ$/, 'ṣ') : ''
    const dup = mapped + dupVowel
    const base = grade ? hit.head + (GUNA[hit.vowel] || hit.vowel) + hit.tail : root
    return dup + base
}

/** 第 7 类：末辅音前插鼻音（rudh → ruṇadh 强 / rundh 弱） */
function class7Stems(root) {
    const m = /^(.*?)([^aāiīuūṛḷ]+)$/.exec(root)
    if (!m) return { strong: root, weak: root }
    const head = m[1]
    const tail = m[2]
    // ṇatva：鼻音前（词根内）有 r / ṣ / ṭ 时用 ṇ（rudh → ruṇadh、bhid → bhinad）
    const nasal = /[rṣṭ]/.test(head) ? 'ṇ' : 'n'
    return {
        strong: head + nasal + 'a' + tail,
        weak: head + 'n' + tail
    }
}

function class6Present(root) {
    return root + 'a'
}

/** 各类例词的将来 / 迂说将来 / 祝愿式词干（不规则词根；其他词根走通用规则，用户也可覆盖） */
const FUTURE_FIX = { bhū: 'bhaviṣya', dviṣ: 'dveṣya', hu: 'hoṣya', div: 'deviṣya', su: 'soṣya', tud: 'totsya', rudh: 'rotsya', tan: 'taniṣya', krī: 'kreiṣya', cur: 'corayiṣya' }
const PERI_FIX = { bhū: 'bhavit', dviṣ: 'dveṣit', hu: 'hot', div: 'devit', su: 'sot', tud: 'tott', rudh: 'roddh', tan: 'tant', krī: 'kret', cur: 'corayit' }
const PERFECT_FIX = { bhū: 'babhūv' }
const BEN_FIX = { bhū: 'bhūyā', dviṣ: 'dviṣyā', hu: 'huyā', div: 'divyā', su: 'suyā', tud: 'tudyā', rudh: 'rudhyā', tan: 'tanyā', krī: 'krīyā', cur: 'coryā' }

/** 简单将来时词干：guṇa + -sya- / -iṣya-（√bhū → bhaviṣya；其余词根可手动覆盖） */
function futureStem(root) {
    if (FUTURE_FIX[root]) return FUTURE_FIX[root]
    const g = gunaStem(root)
    if (g.endsWith('a')) return g + 'iṣya'
    if (/[eo]$/.test(g)) return g + 'ṣya'
    if (/[ṣśs]$/.test(g)) return g + 'ya'
    return g + 'sya'
}

/** 迂说将来时词干 = -tṛ 词干（√bhū → bhavit） */
function periStem(root) {
    if (PERI_FIX[root]) return PERI_FIX[root]
    return futureStem(root).replace(/ya$/, 'it')
}

/** vṛddhi（元音结尾按 āy / āv 处理：nī → nāy、bhū → bhāv、lū → lāv） */
function vrddhiStem(root) {
    const hit = lastVowel(root)
    if (!hit) return root
    const { vowel, head, tail } = hit
    if (!tail) {
        if (vowel === 'i' || vowel === 'ī') return head + 'āy'
        if (vowel === 'u' || vowel === 'ū') return head + 'āv'
        if (vowel === 'a' || vowel === 'ā') return head + 'ā'
        if (vowel === 'ṛ') return head + 'ār'
    }
    const table = { a: 'ā', ā: 'ā', i: 'ai', ī: 'ai', u: 'au', ū: 'au', ṛ: 'ār', ḷ: 'āl' }
    return head + (table[vowel] || vowel) + tail
}

/** 辅音结尾 / 词内用的 vṛddhi（ji → jai） */
function vrddhiVowel(root) {
    const hit = lastVowel(root)
    if (!hit) return root
    const table = { a: 'ā', ā: 'ā', i: 'ai', ī: 'ai', u: 'au', ū: 'au', ṛ: 'ār', ḷ: 'āl' }
    return hit.head + (table[hit.vowel] || hit.vowel) + hit.tail
}

/** स- 型不定过去时词干：diś → dikṣ（词根末咝音 + s → kṣ） */
function saAoristStem(root) {
    if (/[śṣs]$/.test(root)) return root.replace(/[śṣs]$/, 'kṣ')
    return root + 's'
}

/** 叠音型不定过去时词干：ji → jaiṣ（叠音 + 弱化词根 + s） */
function redupAoristStem(root) {
    const fixed = { ji: 'jaiṣ' }
    if (fixed[root]) return fixed[root]
    const hit = lastVowel(root)
    if (!hit) return root + 's'
    const vowel = hit.vowel
    const dupVowel = 'uū'.includes(vowel) ? 'u' : ('iī'.includes(vowel) ? 'i' : 'a')
    const cons = root.slice(0, root.indexOf(vowel)).replace(/h$/, 'j')
    const weak = hit.head + (vowel === 'a' || vowel === 'ā' ? '' : '') + hit.tail
    const stem = cons + dupVowel + weak
    return /[aāiīuūeo]$/.test(stem) ? stem + 'ṣ' : stem + 's'
}

/** 祝愿式词干 = 弱化词根 + -yā（√bhū → bhūyā；√kṛ → kriyā） */
function benStem(root) {
    if (BEN_FIX[root]) return BEN_FIX[root]
    return root.replace(/ṛ$/, 'ri') + 'yā'
}

function class10Present(root) {
    return gunaStem(root) + 'aya'
}

/** 各类的「现在时词干 / 强词干 / 弱词干 / 词根弱化形式 / 被动词干」 */
const STEM_RULES = {
    // ---- 名词 / 形容词：主栏是弱词干，强 / 中词干由弱词干推出 ----
    'noun-ant': (weak) => ({ strong: weak.replace(/t$/, 'nt') }),
    'noun-vas': (weak) => ({
        middle: weak.replace(/uṣ$/, 'vad'),
        strong: weak.replace(/uṣ$/, 'vāṃs')
    }),
    'noun-cons': (weak) => {
        const middle = weak.replace(/ñ$/, '')
        return { middle, strong: middle + 'ān' }
    },
    'adj-ant': (weak) => ({
        strong: weak.replace(/t$/, 'nt'),
        // 中性复数 -anti 接在去 t 的词干后（bhavat → bhav + anti = bhavanti）
        weakDrop: weak.replace(/t$/, '')
    }),

    'verb-class1': (root) => ({
        present: class1Present(root),
        future: futureStem(root),
        peri: periStem(root),
        ben: benStem(root),
        aoristRoot: root,
        perfStem: PERFECT_FIX[root] || '',
        // 完成时 2 单 -tha 前词干末的 v 脱落（babhūv → babhūtha）
        perfStemTha: (PERFECT_FIX[root] || '').replace(/v$/, ''),
        weakRoot: root,
        passive: root + 'y'
    }),
    'verb-class2': (root) => ({
        strong: gunaStrong(root),
        weak: root,
        future: futureStem(root),
        peri: periStem(root),
        ben: benStem(root),
        aoristRoot: root,
        perfStem: PERFECT_FIX[root] || '',
        // 完成时 2 单 -tha 前词干末的 v 脱落（babhūv → babhūtha）
        perfStemTha: (PERFECT_FIX[root] || '').replace(/v$/, ''),
        weakRoot: root,
        passive: root + 'y'
    }),
    'verb-class4': (root) => ({
        present: class4Present(root),
        future: futureStem(root),
        peri: periStem(root),
        ben: benStem(root),
        weakRoot: root,
        passive: class4Present(root)
    }),
    'verb-class3': (root) => {
        const weak = reduplicate(root, false)
        return {
            strong: reduplicate(root, true),
            weak,
            weakImp: weak.replace(/[aāiīuūṛ]$/, ''),
            future: futureStem(root),
            peri: periStem(root),
            ben: benStem(root),
            weakRoot: root,
            passive: root.replace(/u$/, 'ū') + 'y'
        }
    },
    'verb-class5': (root) => ({
        strong: root + 'no',
        weak: root + 'nu',
        // 未完成时用「词根 + n」（su → sun），词尾 -avam 等接在 n 后
        weakImp: root + 'n',
        future: futureStem(root),
        peri: periStem(root),
        ben: benStem(root),
        weakRoot: root,
        passive: root.replace(/u$/, 'ū') + 'y'
    }),
    'verb-class7': (root) => {
        const { strong, weak } = class7Stems(root)
        return {
            strong,
            weak,
            // 未完成时 1 双 / 1 复：词干末的 h 脱落（ruṇadh → ruṇad + va / ma）
            strongD: strong.replace(/h$/, ''),
            future: futureStem(root),
            peri: periStem(root),
            ben: benStem(root),
            weakRoot: root,
            passive: root + 'y'
        }
    },
    'verb-class8': (root) => ({
        strong: root + 'o',
        weak: root + 'u',
        weakImp: root,
        future: futureStem(root),
        peri: periStem(root),
        ben: benStem(root),
        weakRoot: root,
        passive: root.replace(/an$/, 'āy') + (root.endsWith('an') ? '' : 'y')
    }),
    'verb-class6': (root) => ({
        present: class6Present(root),
        future: futureStem(root),
        peri: periStem(root),
        ben: benStem(root),
        aoristRoot: root,
        perfStem: PERFECT_FIX[root] || '',
        // 完成时 2 单 -tha 前词干末的 v 脱落（babhūv → babhūtha）
        perfStemTha: (PERFECT_FIX[root] || '').replace(/v$/, ''),
        weakRoot: root,
        passive: root + 'y'
    }),
    'verb-class9': (root) => ({
        strong: root + 'ṇā',
        weak: root + 'ṇī',
        // 元音开头的词尾前用短 a（krīṇī + anti → krīṇanti）
        weakVowel: root + 'ṇa',
        // 未完成时 1 单：krīṇ + i
        weakImp: root + 'ṇ',
        future: futureStem(root),
        peri: periStem(root),
        ben: benStem(root),
        aoristRoot: root,
        perfStem: PERFECT_FIX[root] || '',
        // 完成时 2 单 -tha 前词干末的 v 脱落（babhūv → babhūtha）
        perfStemTha: (PERFECT_FIX[root] || '').replace(/v$/, ''),
        weakRoot: root,
        passive: root + 'y'
    }),
    'verb-class10': (root) => {
        const present = class10Present(root)
        return {
            present,
            future: futureStem(root),
            peri: periStem(root),
            ben: benStem(root),
            weakRoot: root,
            // 被动词干 = guṇa 词根 + y（cur → cory-），即 present 去掉 -aya
            passive: present.replace(/aya$/, '') + 'y'
        }
    }
}

/**
 * 语言档案的派生入口：`derive.stemDerive` 决定用哪套规则。
 * 返回 { present, strong, weak, middle, weakRoot, passive, ... }，引擎只在用户没填时使用。
 */
/** -ant 分词弱词干：bhavat / juhvat / dviṣat */
function atStem(base) {
    if (/[aā]$/.test(base)) return base.slice(0, -1) + 'at'
    if (/[uū]$/.test(base)) return base.slice(0, -1) + 'vat'
    if (/[iī]$/.test(base)) return base.slice(0, -1) + 'yat'
    return base + 'at'
}

/** a 词干去掉词尾 a（形容词式变格用无尾词干） */
function aBase(stem) {
    return /[aā]$/.test(stem) ? stem.slice(0, -1) : stem
}

/** 用户填的分词词干优先，其次用推导值 */
function pickStem(stems, key, fallback) {
    const value = stems && stems[key]
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

/**
 * 分词 / 不定式词干（例词 √bhū 已与语法页核对）。
 * 用户可以在「分词词干」输入框里覆盖：-ant 填弱词干、-vāṃs 填强词干、a-词干填带 -a 的完整形式。
 */
function nonfiniteStems(out, root, stems) {
    const presentLike = out.weakVowel || out.weak || out.present || root
    out.infStem = gunaStem(root) + 'itum'

    const presAct = pickStem(stems, 'ptcpPresActStem', atStem(presentLike))
    out.ptcpPresActStem = presAct
    out.ptcpWeak = presAct
    out.ptcpStrong = presAct.replace(/t$/, 'nt')
    out.ptcpDrop = presAct.replace(/t$/, '')

    const passive = out.passive || root
    const presPass = pickStem(stems, 'ptcpPresPassStem', passive + (/[aā]$/.test(passive) ? 'māna' : 'amāna'))
    out.ptcpPresPassStem = presPass
    out.presPassPtcp = aBase(presPass)

    const future = out.future || root
    const futAct = pickStem(stems, 'ptcpFutActStem', atStem(future))
    out.ptcpFutActStem = futAct
    out.futActPtcp = futAct
    out.futActPtcpStrong = futAct.replace(/t$/, 'nt')
    out.futActPtcpDrop = futAct.replace(/t$/, '')

    const futPass = pickStem(stems, 'ptcpFutPassStem', future + (/[aā]$/.test(future) ? 'māṇa' : 'amāṇa'))
    out.ptcpFutPassStem = futPass
    out.futPassPtcp = aBase(futPass)

    const perf = out.perfectStem || root
    const perfStrong = pickStem(stems, 'ptcpPerfActStem',
        /v$/.test(perf) ? perf + 'āṃs' : perf + 'vāṃs')
    out.ptcpPerfActStem = perfStrong
    out.perfActPtcpStrong = perfStrong
    out.perfActPtcpMiddle = perfStrong.replace(/āṃs$/, 'ad')
    out.perfActPtcpWeak = perfStrong.replace(/āṃs$/, 'uṣ')
    out.perfActPtcpNeut = out.perfActPtcpMiddle.replace(/d$/, 't')

    const perfPass = pickStem(stems, 'ptcpPerfPassStem', perf + 'āna')
    out.ptcpPerfPassStem = perfPass
    out.perfPassPtcp = aBase(perfPass)

    const pastPass = pickStem(stems, 'ptcpPastPassStem', (out.weakRoot || root) + 'ta')
    out.ptcpPastPassStem = pastPass
    out.pastPassPtcp = aBase(pastPass)

    const tavya = pickStem(stems, 'grdvTavyaStem', (out.peri || root) + 'avya')
    out.grdvTavyaStem = tavya
    out.grdvTavya = aBase(tavya)

    const aniya = pickStem(stems, 'grdvAniyaStem', aBase(presentLike) + 'anīya')
    out.grdvAniyaStem = aniya
    out.grdvAniya = aBase(aniya)

    const ya = pickStem(stems, 'grdvYaStem', aBase(presentLike) + 'ya')
    out.grdvYaStem = ya
    out.grdvYa = aBase(ya)
    return out
}

function aoristStemFor(type, root) {
    switch (type) {
        case 'स्- 不定过去时': return vrddhiStem(root)
        case 'स- 不定过去时': return saAoristStem(root)
        case '叠音不定过去时': return redupAoristStem(root)
        case '被动不定过去时（चिङ्）': return vrddhiStem(root)
        // 词根 / अ- / इष्- 型都用词根本身
        default: return root
    }
}

const PERFECT_STEM_FIX = {
    '叠音型完成时': { bhū: 'babhūv' },
    '元音加强型完成时': { dā: 'dad' },
    '无叠音型完成时': { vid: 'vid' }
}

function perfectStemFor(type, root) {
    const fix = (PERFECT_STEM_FIX[type] || {})[root]
    if (fix) return fix
    // 迂说完成时：例词 √vid 用不可叠音的 vid-，其余沿用叠音型完成时词干
    if (type === '迂说完成时') return root === 'vid' ? 'vid' : perfectStemFor('叠音型完成时', root)
    if (type === '元音加强型完成时') return reduplicate(root, false).replace(/[āīūṛ]$/, '')
    if (type === '无叠音型完成时') return root
    return reduplicate(root, true).replace(/o$/, 'u') + 'v'
}

/**
 * 语言档案的派生入口：`spec.stemDerive` 决定用哪套规则。
 * `stems.aorist` / `stems.perfect` 是用户选中的类型，用来决定不定过去时 / 完成时词干。
 */
export function deriveStems(root, { spec, stems } = {}) {
    const fn = STEM_RULES[spec && spec.stemDerive]
    if (!fn || !root) return {}
    const out = fn(String(root).trim())
    const text = String(root).trim()
    out.aoristStem = aoristStemFor(stems && stems.aorist, text)
    out.perfectStem = perfectStemFor(stems && stems.perfect, text)
    out.perfectStemTha = out.perfectStem.replace(/v$/, '')
    if (stems && stems.perfect === '无叠音型完成时') {
        out.perfectStemStrong = text === 'vid' ? 'ved' : gunaStrong(text)
        out.perfectStemTha = text === 'vid' ? 'vet' : out.perfectStemStrong
    } else {
        out.perfectStemStrong = out.perfectStem
    }
    nonfiniteStems(out, text, stems || {})
    return out
}

/** 梵语档案：derive.post.sandhi 用到 join / wordFinal，derive.post.accent 用到 accent */
export const sandhi = { join: saJoin, wordFinal: saWordFinal }

export function accent(text, mode) {
    return applySaAccent(text, mode)
}
