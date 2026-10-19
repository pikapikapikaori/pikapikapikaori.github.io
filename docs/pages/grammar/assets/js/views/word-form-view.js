import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { submitWord, editWord, fetchWord, queryWords } from '../services/word-service.js'
import { POS_LIST, GENDERS, normalizeParadigm, normalizeStem, normalizeGenders } from '../models/word.js'
import { loadGrammar, getParadigmTemplate, getDeriveSpec, getGenderOptions, collectInflectAnchors, genderOfColumn } from '../services/grammar-service.js'
import { createParadigmTable } from '../components/paradigm-table.js'
import { generateParadigm } from '../models/paradigm-generate.js'
import { toast } from '../components/toast.js'
import { confirmModal } from '../components/modal.js'
import { lookupWordForForm } from '../services/wiktionary-service.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'

const SOURCE_OPTIONS = [
    { value: 'manual', label: '手动' },
    { value: 'wiktionary', label: 'Wiktionary' }
]

const SPECIAL_REF = '__special__'
const INDECL_REF = '__indeclinable__'

/** 不变格 / 不变位的显示名 */
function indeclinableLabel(pos) {
    return pos === 'verb' ? '不变位' : '不变格'
}

export default {
    needsUser: true,
    layout: 'shell',

    async mount(main, ctx) {
        const { userId } = appStore.get()
        const lang = ctx.params.lang
        const language = getLanguage(lang)
        if (!language) {
            replace(main, h('div', { class: 'empty' }, '未知语言：' + lang))
            return
        }

        const editId = ctx.params.id || null
        const isEdit = !!editId

        setBreadcrumbs([
            { label: '语言选择', href: '#/languages' },
            { label: language.name, href: `#/lang/${lang}/words` },
            { label: isEdit ? '编辑生词' : '添加生词' }
        ])

        const grammarDoc = await loadGrammar(lang)

        const data = isEdit ? await loadForEdit(editId) : emptyData()
        if (isEdit && !data) {
            replace(main, h('div', { class: 'empty' },
                h('div', { class: 'empty__title' }, '词条不存在'),
                h('button', {
                    class: 'btn btn--primary',
                    type: 'button',
                    onclick: () => location.hash = `#/lang/${lang}/words`
                }, '返回列表')
            ))
            return
        }

        function emptyData() {
            return {
                id: null,
                language: lang,
                lemma: '',
                pos: 'noun',
                gender: [],
                inflectionType: { label: '', grammarRef: null },
                paradigm: {},
                stem: '',
                inflections: [],
                meanings: [{ text: '', lang: 'zh', source: 'manual' }],
                collocations: [],
                examples: [],
                derivatives: [],
                tags: [],
                notes: ''
            }
        }

        async function loadForEdit(id) {
            const w = await fetchWord(id)
            if (!w) return null
            return {
                id: w.id,
                language: w.language,
                lemma: w.lemma,
                pos: w.pos,
                gender: normalizeGenders(w.gender, w.pos),
                inflectionType: {
                    label: (w.inflectionType && w.inflectionType.label) || '',
                    grammarRef: (w.inflectionType && w.inflectionType.grammarRef) || null
                },
                paradigm: normalizeParadigm(w.paradigm),
                stem: normalizeStem(w.stem),
                inflections: (w.inflections || []).map((x) => ({ ...x })),
                meanings: (w.meanings || []).map((x) => ({ ...x })),
                collocations: (w.collocations || []).map((x) => ({ ...x })),
                examples: (w.examples || []).map((x) => ({ ...x })),
                derivatives: [...(w.derivatives || [])],
                tags: [...(w.tags || [])],
                notes: w.notes || ''
            }
        }

        /* ---------- 顶部 ---------- */
        const head = h('div', { class: 'page-head' },
            h('div', {},
                h('div', { class: 'page-head__title' },
                    isEdit ? '编辑生词' : '添加生词'
                ),
                h('div', { class: 'page-head__sub' },
                    h('span', { lang: lang }, language.native),
                    ' · ', language.name
                )
            )
        )

        /* ---------- 表单 ---------- */
        const form = h('form', {
            class: 'word-form',
            onsubmit: (e) => { e.preventDefault(); onSubmit() }
        })

        /* ---------- 渲染函数（先声明，后赋值） ---------- */
        let renderMeanings = () => {}
        let renderInflections = () => {}
        let renderExamples = () => {}

        const lemmaInput = h('input', {
            class: 'input',
            type: 'text',
            placeholder: '基本形态',
            value: data.lemma,
            lang: lang,
            required: true,
            disabled: isEdit
        })

        const lookupBtn = h('button', {
            class: 'btn btn--sm',
            type: 'button',
            title: '从 Wiktionary 英文版获取释义、例句、变格/变位',
            onclick: onLookup
        }, '从 Wiktionary 查询')

        const lookupStatus = h('div', { class: 'field__hint' }, '')

        const posSelect = h('select', {
            class: 'select',
            disabled: isEdit
        }, ...POS_LIST.map((p) => h('option', {
            value: p.value,
            selected: data.pos === p.value
        }, p.label)))

        let currentOptionsById = {}

        // 语法锚点：只列「变格 / 变位类型」，外加 特殊 / 不变
        const inflectionRef = h('select', {
            class: 'select',
            onchange: (e) => {
                const v = e.target.value
                const opt = currentOptionsById[v]
                // 只在 label 为空时自动填充，避免覆盖用户已填的内容
                if (v !== SPECIAL_REF && opt && !inflectionLabel.value.trim()) {
                    inflectionLabel.value = opt.short || opt.label
                } else if (v === INDECL_REF && !inflectionLabel.value.trim()) {
                    inflectionLabel.value = indeclinableLabel(posSelect.value)
                }
                refreshGenerateBtn()
            }
        })

        function rebuildRefOptions(initialValue) {
            const pos = posSelect.value
            const opts = collectInflectAnchors(grammarDoc, lang, pos)
            currentOptionsById = Object.fromEntries(opts.map((o) => [o.id, o]))

            const prev = initialValue !== undefined ? initialValue : inflectionRef.value
            const ids = new Set(opts.map((o) => o.id))
            const selected = (prev && ids.has(prev))
                ? prev
                : (prev === INDECL_REF ? INDECL_REF : SPECIAL_REF)

            inflectionRef.replaceChildren(
                h('option', {
                    value: SPECIAL_REF,
                    selected: selected === SPECIAL_REF
                }, pos === 'verb' ? '特殊变位（自行填写）' : '特殊变格（自行填写）'),
                h('option', {
                    value: INDECL_REF,
                    selected: selected === INDECL_REF
                }, indeclinableLabel(pos)),
                ...opts.map((o) => h('option', {
                    value: o.id,
                    selected: selected === o.id
                }, o.label))
            )
            refreshGenerateBtn()
        }

        posSelect.addEventListener('change', () => {
            data.pos = posSelect.value
            data.gender = normalizeGenders(data.gender, data.pos)
            rebuildRefOptions()
            renderGenderField()
            renderParadigmBlock()
        })

        const inflectionLabel = h('input', {
            class: 'input',
            type: 'text',
            placeholder: '变格 / 变位类型说明（如：第一变位法）',
            value: data.inflectionType.label
        })

        const principalInput = h('input', {
            class: 'input',
            type: 'text',
            lang: lang,
            placeholder: '主要部分，如 am、λόγ',
            value: data.stem,
            oninput: () => refreshGenerateBtn()
        })

        const generateBtn = h('button', {
            class: 'btn btn--sm',
            type: 'button',
            onclick: onGenerate
        }, '生成表格')

        /* ---------- 语法性（仅名词） ---------- */

        const genderSlot = h('div', {})

        function renderGenderField() {
            genderSlot.replaceChildren()
            if (posSelect.value !== 'noun') return

            const options = getGenderOptions(grammarDoc, 'noun')
            if (!options.length) return

            const chips = h('div', { class: 'chip-group' },
                ...options.map((g) => {
                    const label = GENDERS.find((x) => x.value === g)
                    const active = data.gender.includes(g)
                    return h('button', {
                        class: 'chip' + (active ? ' chip--active' : ''),
                        type: 'button',
                        'aria-pressed': String(active),
                        onclick: (e) => {
                            const i = data.gender.indexOf(g)
                            if (i >= 0) data.gender.splice(i, 1)
                            else data.gender.push(g)
                            data.gender = normalizeGenders(data.gender, 'noun')
                            e.currentTarget.classList.toggle('chip--active', data.gender.includes(g))
                            e.currentTarget.setAttribute('aria-pressed', String(data.gender.includes(g)))
                            renderParadigmBlock()
                        }
                    }, label ? label.label : g)
                })
            )

            genderSlot.appendChild(field('语法性', chips,
                '可多选（如 common gender 同时为阳性与阴性）。只显示所选性别的变格列。'))
        }

        // 语法锚点下拉：特殊变格/变位 + 语法速查条目

        form.appendChild(h('div', { class: 'word-form__row' },
            h('label', { class: 'field' },
                h('span', { class: 'field__label' }, '基本形态'),
                lemmaInput,
                h('div', { class: 'field__actions' },
                    lookupBtn,
                    lookupStatus
                ),
                h('span', { class: 'field__hint' }, '唯一键的一部分，同一语言下必须唯一。编辑时不可修改。')
            ),
            field('词性', posSelect, '')
        ))

        form.appendChild(genderSlot)

        form.appendChild(field('主要部分',
            h('div', { class: 'field__row' }, principalInput, generateBtn),
            '词干：不变的部分，词形变化在其后追加词尾，如拉丁语 am → amō / amāre、古希腊语 λόγ → λόγος。末尾的「-」只是显示用，不用填。'))

        form.appendChild(h('div', { class: 'word-form__row' },
            field('变格 / 变位类型', inflectionLabel, '显示在词卡正面的徽章。'),
            field('语法锚点', inflectionRef, '选具体条目可跳转语法速查；选「特殊」则自行填写类型说明。')
        ))

        form.appendChild(buildMeaningGroup())

        const paradigmSlot = h('div', {})
        form.appendChild(paradigmSlot)

        form.appendChild(buildInflectionGroup())
        form.appendChild(buildCollocationGroup())
        form.appendChild(buildExampleGroup())
        form.appendChild(buildDerivativeGroup())
        form.appendChild(buildExtrasGroup())

        const submitBtn = h('button', {
            class: 'btn btn--primary',
            type: 'submit'
        }, isEdit ? '保存修改' : '添加')

        const cancelBtn = h('button', {
            class: 'btn',
            type: 'button',
            onclick: () => location.hash = `#/lang/${lang}/words`
        }, '取消')

        if (isEdit) {
            form.appendChild(h('div', { class: 'word-form__actions' },
                h('button', {
                    class: 'btn btn--danger',
                    type: 'button',
                    onclick: onDelete
                }, '删除'),
                h('div', { style: { flex: 1 } }),
                cancelBtn,
                submitBtn
            ))
        } else {
            form.appendChild(h('div', { class: 'word-form__actions' },
                cancelBtn,
                submitBtn
            ))
        }

        rebuildRefOptions(data.inflectionType.grammarRef || SPECIAL_REF)
        replace(main, head, form)

        renderGenderField()
        renderParadigmBlock()
        refreshGenerateBtn()

        /* ---------- 按主要部分生成表格 ---------- */

        /** 当前「变格 / 变位类型」对应的生成规则 */
        function currentDeriveSpec() {
            const ref = inflectionRef.value
            if (!ref || ref === SPECIAL_REF || ref === INDECL_REF) return null
            return getDeriveSpec(grammarDoc, ref)
        }

        function refreshGenerateBtn() {
            const spec = currentDeriveSpec()
            const hasStem = !!normalizeStem(principalInput.value)
            generateBtn.disabled = !spec || !hasStem
            if (!spec) generateBtn.title = '该变格 / 变位类型还没有自动生成规则'
            else if (!hasStem) generateBtn.title = '请先填写主要部分'
            else generateBtn.title = '按主要部分和词尾规则自动填表'
        }

        function onGenerate() {
            const spec = currentDeriveSpec()
            if (!spec) return

            const stem = normalizeStem(principalInput.value)
            if (!stem) {
                toast.error('请先填写主要部分')
                principalInput.focus()
                return
            }

            const { paradigm, filled } = generateParadigm({
                stem,
                spec,
                template: getParadigmTemplate(grammarDoc, data.pos),
                existing: data.paradigm
            })

            if (!filled.length) {
                toast.info('没有可填的空格（已有内容不会被覆盖）')
                return
            }

            for (const [tableKey, rows] of Object.entries(paradigm)) {
                if (!data.paradigm[tableKey]) data.paradigm[tableKey] = {}
                for (const [rowKey, cells] of Object.entries(rows)) {
                    if (!data.paradigm[tableKey][rowKey]) data.paradigm[tableKey][rowKey] = {}
                    Object.assign(data.paradigm[tableKey][rowKey], cells)
                }
            }
            renderParadigmBlock()
            toast.success(`已按主要部分生成 ${filled.length} 格，请确认无误后保存`, 5000)
        }

        /* ---------- 表格块渲染 ---------- */

        /** 名词只渲染所选性别的列 */
        function hiddenGenderColumns(tpl) {
            if (data.pos !== 'noun' || !data.gender.length) return []
            const hidden = []
            for (const table of tpl?.tables || []) {
                for (const col of table.columns || []) {
                    const g = genderOfColumn(col.key)
                    if (g && !data.gender.includes(g)) hidden.push(col.key)
                }
            }
            return hidden
        }

        function renderParadigmBlock() {
            paradigmSlot.replaceChildren()
            const tpl = getParadigmTemplate(grammarDoc, data.pos)
            if (!tpl) return

            const wrap = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, `${posLabel(data.pos)}变${data.pos === 'verb' ? '位' : '格'}表格`),
                    h('span', { class: 'field__hint' }, '仅填写你需要的形式，空白格不渲染')
                )
            )

            for (const tableTpl of tpl.tables || []) {
                const tableData = data.paradigm[tableTpl.key] || {}
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang,
                    mode: 'edit',
                    showTitle: true,
                    hideColumns: hiddenGenderColumns(tpl),
                    onGrammarRef: (ref) => {
                        location.hash = `#/grammar/${lang}#${ref}`
                    },
                    editable: {
                        onChange: (rowKey, colKey, value) => {
                            if (!data.paradigm[tableTpl.key]) data.paradigm[tableTpl.key] = {}
                            if (!data.paradigm[tableTpl.key][rowKey]) data.paradigm[tableTpl.key][rowKey] = {}
                            const s = String(value ?? '').trim()
                            if (s) data.paradigm[tableTpl.key][rowKey][colKey] = s
                            else delete data.paradigm[tableTpl.key][rowKey][colKey]
                        }
                    }
                })
                if (tbl) wrap.appendChild(tbl)
            }

            paradigmSlot.appendChild(wrap)
        }

        /* ---------- Wiktionary 查询 ---------- */

        async function onLookup() {
            const lemma = lemmaInput.value.trim()
            if (!lemma) {
                toast.error('请先输入基本形态')
                lemmaInput.focus()
                return
            }

            lookupBtn.disabled = true
            const originalText = lookupBtn.textContent
            lookupBtn.textContent = '查询中…'
            lookupStatus.textContent = ''
            lookupStatus.style.color = ''

            try {
                const patch = await lookupWordForForm({
                    lemma,
                    langCode: lang,
                    preferredPos: posSelect.value,
                    grammarDoc
                })

                if (!patch) {
                    lookupStatus.textContent = 'Wiktionary 未找到该词条'
                    lookupStatus.style.color = 'var(--c-fg-subtle)'
                    return
                }

                if (patch.pos && patch.pos !== posSelect.value) {
                    posSelect.value = patch.pos
                    data.pos = patch.pos
                }

                if (patch.meanings.length) {
                    data.meanings = patch.meanings
                    renderMeanings()
                }

                if (patch.examples.length) {
                    data.examples = patch.examples
                    renderExamples()
                }

                if (Object.keys(patch.paradigm).length) {
                    const tpl = getParadigmTemplate(grammarDoc, patch.pos)
                    if (tpl) {
                        if (!data.paradigm) data.paradigm = {}
                        if (!data.paradigm.main) data.paradigm.main = {}
                        Object.assign(data.paradigm.main, patch.paradigm)
                        renderParadigmBlock()
                    }
                }

                if (patch.inflections.length) {
                    data.inflections.push(...patch.inflections)
                    renderInflections()
                }

                lookupStatus.textContent = `已获取：${patch.summary}`
                lookupStatus.style.color = 'var(--c-success)'
                toast.success(`已从 Wiktionary 获取「${lemma}」`)
            } catch (err) {
                console.error(err)
                lookupStatus.textContent = `查询失败：${err.message}`
                lookupStatus.style.color = 'var(--c-danger)'
                toast.error(`查询失败：${err.message}`)
            } finally {
                lookupBtn.disabled = false
                lookupBtn.textContent = originalText
            }
        }

        /* ---------- 其余分组 ---------- */

        function buildMeaningGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '含义'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => {
                            data.meanings.push({ text: '', lang: 'zh', source: 'manual' })
                            renderMeanings()
                        }
                    }, '＋ 添加含义')
                ),
                list
            )

            renderMeanings = function () {
                list.replaceChildren()
                data.meanings.forEach((m, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--meaning' },
                        h('input', {
                            class: 'input', placeholder: '含义', value: m.text,
                            lang: m.lang === 'en' ? 'en' : undefined,
                            oninput: (e) => { m.text = e.target.value }
                        }),
                        h('select', {
                            class: 'select',
                            onchange: (e) => { m.lang = e.target.value }
                        },
                        h('option', { value: 'zh', selected: m.lang === 'zh' }, '中文'),
                        h('option', { value: 'en', selected: m.lang === 'en' }, 'English')
                        ),
                        sourceSelect(m.source, (v) => { m.source = v }),
                        h('button', {
                            class: 'btn btn--ghost btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该含义',
                            onclick: () => {
                                data.meanings.splice(idx, 1)
                                if (data.meanings.length === 0) {
                                    data.meanings.push({ text: '', lang: 'zh', source: 'manual' })
                                }
                                renderMeanings()
                            }
                        }, '✕')
                    ))
                })
            }
            renderMeanings()
            return group
        }

        function buildInflectionGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '补充形式（不定式、命令式、动名词、日语活用等）'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => {
                            data.inflections.push({ group: '', label: '', form: '', source: 'manual' })
                            renderInflections()
                        }
                    }, '＋ 添加')
                ),
                list
            )

            renderInflections = function () {
                list.replaceChildren()
                data.inflections.forEach((it, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--inflection' },
                        h('input', {
                            class: 'input', placeholder: '分组（可选）', value: it.group || '',
                            oninput: (e) => { it.group = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: '标签', value: it.label,
                            oninput: (e) => { it.label = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: '形态', value: it.form, lang: lang,
                            oninput: (e) => { it.form = e.target.value }
                        }),
                        sourceSelect(it.source, (v) => { it.source = v }),
                        h('button', {
                            class: 'btn btn--ghost btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该形式',
                            onclick: () => {
                                data.inflections.splice(idx, 1)
                                renderInflections()
                            }
                        }, '✕')
                    ))
                })
            }
            renderInflections()
            return group
        }

        function buildCollocationGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '固定搭配（可选）'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => {
                            data.collocations.push({ text: '', gloss: '', source: 'manual' })
                            render()
                        }
                    }, '＋ 添加')
                ),
                list
            )

            function render() {
                list.replaceChildren()
                data.collocations.forEach((it, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item' },
                        h('input', {
                            class: 'input', placeholder: '搭配文本', value: it.text, lang: lang,
                            oninput: (e) => { it.text = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: '释义', value: it.gloss,
                            oninput: (e) => { it.gloss = e.target.value }
                        }),
                        sourceSelect(it.source, (v) => { it.source = v }),
                        h('button', {
                            class: 'btn btn--ghost btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该搭配',
                            onclick: () => { data.collocations.splice(idx, 1); render() }
                        }, '✕')
                    ))
                })
            }
            render()
            return group
        }

        function buildExampleGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '例句（可选）'),
                    h('button', {
                        class: 'btn btn--ghost btn--sm', type: 'button',
                        onclick: () => {
                            data.examples.push({ text: '', translation: '', citation: '', source: 'manual' })
                            renderExamples()
                        }
                    }, '＋ 添加')
                ),
                list
            )

            renderExamples = function () {
                list.replaceChildren()
                data.examples.forEach((it, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--example' },
                        h('input', {
                            class: 'input', placeholder: '例句原文', value: it.text, lang: lang,
                            oninput: (e) => { it.text = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: '出处', value: it.citation,
                            oninput: (e) => { it.citation = e.target.value }
                        }),
                        sourceSelect(it.source, (v) => { it.source = v }),
                        h('input', {
                            class: 'input word-form__cell--wide', placeholder: '译文', value: it.translation,
                            oninput: (e) => { it.translation = e.target.value }
                        }),
                        h('button', {
                            class: 'btn btn--ghost btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该例句',
                            onclick: () => { data.examples.splice(idx, 1); renderExamples() }
                        }, '✕')
                    ))
                })
            }
            renderExamples()
            return group
        }

        function buildDerivativeGroup() {
            const selected = h('div', { class: 'chip-group' })
            const results = h('div', { class: 'picker-results' })
            const hint = h('div', { class: 'field__hint' }, '')

            const searchInput = h('input', {
                class: 'input',
                type: 'search',
                placeholder: '搜索本语言词库（基本形态 / 主要部分）…',
                oninput: () => scheduleSearch()
            })

            let timer = null
            let seq = 0

            function scheduleSearch() {
                clearTimeout(timer)
                timer = setTimeout(runSearch, 180)
            }

            async function runSearch() {
                const q = searchInput.value.trim()
                results.replaceChildren()
                if (!q) {
                    hint.textContent = ''
                    return
                }

                const mySeq = ++seq
                const res = await queryWords(userId, lang, {
                    q,
                    scope: 'head',      // 只检索基本形态 + 主要部分
                    page: 1,
                    pageSize: 50
                })
                if (mySeq !== seq) return

                const items = res.items.filter((w) => w.lemma !== lemmaInput.value.trim())
                if (!items.length) {
                    hint.textContent = '未找到，请先添加该词'
                    return
                }
                hint.textContent = ''

                for (const w of items) {
                    const picked = data.derivatives.includes(w.lemma)
                    results.appendChild(h('button', {
                        class: 'picker-item' + (picked ? ' picker-item--picked' : ''),
                        type: 'button',
                        onclick: () => {
                            const i = data.derivatives.indexOf(w.lemma)
                            if (i >= 0) data.derivatives.splice(i, 1)
                            else data.derivatives.push(w.lemma)
                            renderSelected()
                            runSearch()
                        }
                    },
                    h('span', { class: 'picker-item__lemma', lang }, w.lemma),
                    h('span', { class: 'picker-item__pos' }, posLabel(w.pos)),
                    h('span', { class: 'picker-item__gloss' },
                        (w.meanings || []).map((m) => m.text).filter(Boolean).join('；'))
                    ))
                }
            }

            function renderSelected() {
                selected.replaceChildren()
                if (!data.derivatives.length) {
                    selected.appendChild(h('span', { class: 'field__hint' }, '尚未选择派生词'))
                    return
                }
                for (const lemma of data.derivatives) {
                    selected.appendChild(h('span', { class: 'chip chip--active' },
                        h('span', { lang }, lemma),
                        h('button', {
                            class: 'chip__remove',
                            type: 'button',
                            'aria-label': `移除 ${lemma}`,
                            onclick: () => {
                                data.derivatives = data.derivatives.filter((x) => x !== lemma)
                                renderSelected()
                                runSearch()
                            }
                        }, '✕')
                    ))
                }
            }

            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', {}, '派生词（可选）'),
                    h('span', { class: 'field__hint' }, '只能选择词库中已存在的词')
                ),
                h('div', { class: 'derivative-picker' },
                    selected,
                    h('div', { class: 'field' }, searchInput, hint),
                    results
                )
            )

            renderSelected()
            return group
        }

        function buildExtrasGroup() {
            const tagsInput = h('input', {
                class: 'input',
                placeholder: '标签，用逗号分隔（如 高频, 文献A）',
                value: data.tags.join(', ')
            })
            const notesInput = h('textarea', {
                class: 'textarea',
                placeholder: '备注',
                value: data.notes
            })
            return h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' }, h('span', {}, '标签与备注')),
                field('标签', tagsInput),
                field('备注', notesInput)
            )
        }

        /* ---------- 提交 ---------- */

        async function onSubmit() {
            const tagsRaw = form.querySelector('input[placeholder^="标签"]').value
            data.tags = tagsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)

            const lemma = lemmaInput.value.trim()
            if (!lemma) {
                toast.error('基本形态不能为空')
                lemmaInput.focus()
                return
            }

            const refValue = inflectionRef.value
            const grammarRef = (refValue && refValue !== SPECIAL_REF && refValue !== INDECL_REF)
                ? refValue
                : null

            const payload = {
                language: lang,
                lemma,
                pos: posSelect.value,
                gender: normalizeGenders(data.gender, posSelect.value),
                inflectionType: {
                    label: inflectionLabel.value.trim(),
                    grammarRef
                },
                paradigm: normalizeParadigm(data.paradigm),
                stem: normalizeStem(principalInput.value),
                inflections: cleanList(data.inflections, ['form']),
                meanings: cleanList(data.meanings, ['text']),
                collocations: cleanList(data.collocations, ['text']),
                examples: cleanList(data.examples, ['text']),
                derivatives: data.derivatives.map((s) => s.trim()).filter(Boolean),
                tags: data.tags,
                notes: data.notes || ''
            }

            try {
                if (isEdit) {
                    await editWord(data.id, payload)
                    toast.success('已保存')
                } else {
                    const res = await submitWord(userId, lang, payload)
                    if (res.created) toast.success('已添加')
                    else toast.success(`「${lemma}」已存在，记录次数 +1`)
                }
                location.hash = `#/lang/${lang}/words`
            } catch (err) {
                console.error(err)
                if (String(err.name) === 'ConstraintError') {
                    toast.error('唯一键冲突：同语言下基本形态与词性已存在', 5000)
                } else {
                    toast.error(`保存失败：${err.message}`, 5000)
                }
            }
        }

        async function onDelete() {
            const ok = await confirmModal({
                title: '删除词条',
                message: `确定删除「${data.lemma}」？`,
                confirmLabel: '删除',
                danger: true
            })
            if (!ok) return
            const { deleteWord } = await import('../store/word-store.js')
            await deleteWord(data.id)
            toast.success('已删除')
            location.hash = `#/lang/${lang}/words`
        }
    }
}

function field(label, control, hint) {
    return h('label', { class: 'field' },
        h('span', { class: 'field__label' }, label),
        control,
        hint ? h('span', { class: 'field__hint' }, hint) : null
    )
}

function sourceSelect(value, onChange) {
    return h('select', {
        class: 'select',
        onchange: (e) => onChange(e.target.value)
    }, ...SOURCE_OPTIONS.map((o) => h('option', {
        value: o.value,
        selected: (value || 'manual') === o.value
    }, o.label)))
}

function cleanList(list, requiredKeys) {
    const out = []
    for (const item of list || []) {
        const copy = { ...item }
        const ok = requiredKeys.every((k) => String(copy[k] || '').trim())
        if (!ok) continue
        for (const k of Object.keys(copy)) {
            if (typeof copy[k] === 'string') copy[k] = copy[k].trim()
        }
        out.push(copy)
    }
    return out
}

function posLabel(pos) {
    const hit = POS_LIST.find((p) => p.value === pos)
    return hit ? hit.label : pos
}

