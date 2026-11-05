import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { submitWord, editWord, fetchWord, queryWords } from '../services/word-service.js'
import {
    normalizeParadigm, normalizeStem, normalizeStems, sourceLabel
} from '../models/word.js'
import {
    loadGrammar, loadGrammarMeta, loadParadigmProfile, loadScriptProfile, getParadigmTemplate, getDeriveSpec, getGenderOptions,
    getFieldDefs, fieldDefsOfTemplate, collectInflectAnchors, genderOfColumn, genderOfRow, termsOf, fillTerms,
    getDeriveParts, stemLabelOf
} from '../services/grammar-service.js'
import { createParadigmTable } from '../components/paradigm-table.js'
import { openCardOverlay } from '../components/card-overlay.js'
import { createGhostInput } from '../components/ghost-input.js'
import { createSelect } from '../components/select-field.js'
import { meaningsOfSource, meaningRefLabel } from '../components/entry-lists.js'
import { fieldRow } from '../components/form-field.js'
import { bdiNode, bdiText } from '../utils/bdi.js'
import { createTabGroup } from '../components/tabs.js'
import { generateParadigm, previewStem } from '../models/paradigm-generate.js'
import { toast } from '../components/toast.js'
import { confirmModal, openModal } from '../components/modal.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'
import {
    EXTERNAL_BASE, EXTERNAL_SOURCES, POS_LIST
} from '../config/config.js'
import { posOptions } from '../utils/pos.js'
import { takePendingLookup } from '../store/pending-lookup.js'
import { createPageTools } from '../components/page-tools.js'
import { annotateDualText, setDualTextVisible } from '../utils/dual-text.js'
import { annotateBreves, setBreveVisible } from '../utils/breve.js'
import { deleteWord } from '../store/word-store.js'

const SPECIAL_REF = '__special__'
const INDECL_REF = '__indeclinable__'


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
            { label: '语言列表', href: '#/languages' },
            { label: language.name, href: `#/lang/${lang}/words` },
            { label: isEdit ? '编辑生词' : '添加生词' }
        ])

        const grammarDoc = await loadGrammar(lang)
        // 没有语法数据的语言（英 / 古汉语）也要能读到 meta.terms 里的文案
        const grammarMeta = await loadGrammarMeta(lang)

        // 外部数据源：按 config 清单逐个动态 import，缺文件 / 离线时跳过
        const externalSources = (await Promise.all(EXTERNAL_SOURCES.map(async (src) => {
            try {
                const mod = await import(new URL(`${src.file}.js`, EXTERNAL_BASE))
                if (typeof mod.lookupWordForForm !== 'function') {
                    console.warn(`[external] ${src.id} 没有导出 lookupWordForForm`)
                    return null
                }
                return { ...src, lookupWordForForm: mod.lookupWordForForm }
            } catch (err) {
                console.warn(`[external] ${src.id} 加载失败`, err)
                return null
            }
        }))).filter(Boolean)
        // 语言可以自定义「词干」的叫法与提示（如希伯来语是词根辅音）
        /** 当前词性的界面用词（各语言在自己的 JSON 里声明） */
        // 用 data.pos 而不是 posSelect.value：后者在表单搭好之前还取不到（TDZ）
        function currentTerms() { return termsOf(grammarDoc || grammarMeta, data.pos) }

        /** 取 terms 里的文案；`lemma.label` 这种带点的键走子对象 */
        function termText(key, suffix = '') {
            const t = currentTerms()
            const value = key.split('.').reduce((obj, k) => (obj == null ? undefined : obj[k]), t)
            return (typeof value === 'string' ? value : '') + (suffix ? t[suffix] : '')
        }

        /** 文案来自 terms：挂 data-term，切词性时由 applyTerms() 统一刷新（data-term-suffix 追加可选后缀） */
        function termNode(key, suffix = '') {
            return h('span', { dataset: { term: key, termSuffix: suffix } }, termText(key, suffix))
        }

        /** 说明文字可能夹原文（如希伯来语词尾 ־ָה / ־ֶת），按字符范围包 bdi */
        function hintText(text) { return bdiText(text, lang) }

        /** 满文 / 天城文：输入允许写转写，失焦时归一成原文；存储与生词卡都用原文 */
        function attachScriptNormalize(input) {
            if (typeof scriptProfile?.toScript !== 'function') return
            input.addEventListener('focusout', () => {
                const value = input.value
                if (!value || !value.trim()) return
                const next = String(scriptProfile.toScript(value) ?? value)
                if (next !== value) input.value = next
            })
        }

        /** 词性变了以后，界面上这些文案要跟着换（各词性可以有自己的说法） */
        function applyTerms() {
            const t = currentTerms()
            inflectionTypeLabelEl.textContent = t.inflectionType
            inflectionTypeHintEl.replaceChildren(hintText(t.inflectionTypeHint))
            anchorHintEl.replaceChildren(hintText(t.anchorHint))
            inflectionLabel.placeholder = t.inflectionTypePlaceholder
            refreshStemsText()
            const extra = form.querySelector('.js-extra-forms-title')
            if (extra) extra.textContent = t.extraForms

            for (const el of form.querySelectorAll('[data-term]')) {
                el.textContent = termText(el.dataset.term, el.dataset.termSuffix)
            }
            // placeholder 与空态文案在行渲染时取，重新渲染这几块
            renderMeanings()
            renderInflections()
            renderCollocations()
            renderExamples()
            renderDerivatives()
            renderExtras()
        }
        const paradigmProfile = await loadParadigmProfile(lang, grammarDoc)
        // 文字档案（满文 / 天城文）：生成时把结果转成原文、把用户输入的原文转回转写。
        // 注意第二个参数是 meta（要读 meta.files.script），不是 grammar 文档。
        const scriptProfile = await loadScriptProfile(lang, grammarMeta)

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
                attributes: {},
                inflectionType: { label: '', grammarRef: null },
                paradigm: {},
                stems: { base: '' },
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
                attributes: { ...(w.attributes || {}) },
                inflectionType: {
                    label: (w.inflectionType && w.inflectionType.label) || '',
                    grammarRef: (w.inflectionType && w.inflectionType.grammarRef) || null
                },
                paradigm: normalizeParadigm(w.paradigm),
                stems: normalizeStems(w.stems),
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
        const head = h('div', { class: 'page-head page-head--display' },
            h('div', {},
                h('h1', { class: 'page-head__title' },
                    bdiNode(language.native, lang),
                    ' · ', language.name
                ),
                h('div', { class: 'page-head__sub' }, isEdit ? '编辑生词' : '添加生词')
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
        let renderCollocations = () => {}
        let renderDerivatives = () => {}
        let renderExtras = () => {}
        /** 切换「含义」的来源 tab（查询回填后跳到对应来源） */
        let setMeaningSource = () => {}
        /** 「标签」输入框（提交时读它） */
        let tagsInput = null
        /** 「含义」区当前所在的来源 tab：例句里的含义引用靠它判断要不要加来源前缀 */
        let meaningSource = 'manual'
        /** 「固定搭配」「例句」各自的来源 tab */
        let collocationSource = 'manual'
        let exampleSource = 'manual'

        /** 来源 tab 的候选：手动 → 已注册的外部源 → 数据里实际出现的其它来源 */
        function sourceIds(items = []) {
            const ids = ['manual', ...externalSources.map((src) => src.id)]
            for (const it of items) {
                const id = it.source || 'manual'
                if (!ids.includes(id)) ids.push(id)
            }
            return ids
        }

        /** 某个区块的来源 tab 条 */
        function sourceTabBar({ items, active, onPick }) {
            return h('div', { class: 'source-tabs word-form__meaning-tabs' },
                ...sourceIds(items).map((id) => h('button', {
                    class: 'source-tab' + (id === active ? ' source-tab--active' : ''),
                    type: 'button',
                    role: 'tab',
                    'aria-selected': String(id === active),
                    onclick: () => { if (id !== active) onPick(id) }
                }, sourceLabel(id)))
            )
        }

        /** 切换后默认落在第一个有内容的来源上 */
        function firstSourceWithContent(items) {
            const hit = sourceIds(items).find((id) => items.some((it) => (it.source || 'manual') === id && Object.values(it).some((v) => typeof v === 'string' && v.trim())))
            return hit || 'manual'
        }

        /** 行首序号的占位格：内容由 renumberItems 填，空行保持空白 */
        function indexCell() {
            return h('span', { class: 'word-form__index' })
        }

        /**
         * 只有填了必填内容（会被保存）的行才占号 —— 空行不算，
         * 这样表单里的编号和保存后词卡里的编号是同一套。
         * 直接改序号格、不重渲染，打字时不会丢焦点。
         */
        function renumberItems(listEl, isFilled) {
            let n = 0
            Array.from(listEl.children).forEach((item, i) => {
                const cell = item.querySelector('.word-form__index')
                if (!cell) return
                if (isFilled(i)) {
                    n += 1
                    cell.textContent = String(n)
                } else {
                    cell.textContent = ''
                }
            })
        }

        const lemmaField = createGhostInput({
            value: data.lemma,
            lang,
            placeholder: currentTerms().lemma.placeholder,
            disabled: isEdit,
            // 基本形态可以推出词干（stemForms.base.from = 'headword'）时影响 placeholder 预览
            onInput: () => {
                refreshStemGhosts()
                refreshGenerateBtn()
                refreshLookupBtn()
            }
        })
        const lemmaInput = lemmaField.input
        lemmaField.el.addEventListener('focusout', () => {
            if (typeof scriptProfile?.toScript !== 'function') return
            const value = lemmaInput.value
            if (!value || !value.trim()) return
            const next = String(scriptProfile.toScript(value) ?? value)
            if (next !== value) lemmaInput.value = next
        })

        /* ---------- 外部数据源：按一次查全部，多个词性弹窗选 ---------- */

        /** 当前选中的变格 / 变位表（多表时用 tab 切换） */
        let paradigmTab = null
        /** 上一次由查询自动填的「变格 / 变位类型」文案，用于切换候选时判断能否覆盖 */
        let autoInflectionLabel = ''
        /** 正在套用查询结果时，词性变更不应触发「清空下面所有内容」 */
        let applyingLookup = false

        const lookupStatus = h('span', { class: 'field__hint lookup__status' }, '')

        const lookupBtn = h('button', {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () => onLookupAll()
        }, '从来源查询')

        /** 没填基本形态就不能查：和「词干没填时生成表格」一样的禁用逻辑 */
        function refreshLookupBtn() {
            const has = Boolean(lemmaInput.value.trim()) && externalSources.length > 0
            lookupBtn.disabled = !has
            lookupBtn.title = has
                ? '从所有外部来源获取语法性、变格变位类型、语法锚点、词干与含义'
                : '请先填写基本形态'
        }

        const posSelect = h('select', {
            class: 'select',
            disabled: isEdit
        }, ...posOptions(language.pos).map((p) => h('option', {
            value: p.value,
            selected: data.pos === p.value
        }, p.label)))

        let currentOptionsById = {}

        // 语法锚点：只列「变格 / 变位类型」，外加 特殊 / 不变
        // 类别名里带着原文（如希伯来语「III-ה 词根」），所以用自绘下拉，收起态也能包 bdi
        const inflectionRef = createSelect({
            lang,
            className: 'select',
            onChange: (v) => {
                const opt = currentOptionsById[v]
                // 换锚点要重写类型说明，否则内容不跟着变：特殊 → 清空待填；
                // 不变 → 该语言的「不变形」；其余 → 锚点的短名
                if (v === SPECIAL_REF) inflectionLabel.value = ''
                else if (v === INDECL_REF) inflectionLabel.value = currentTerms().indeclinable
                else if (opt) inflectionLabel.value = opt.short || opt.label
                autoInflectionLabel = inflectionLabel.value
                renderExtraParts()
                // 锚点决定词干推导规则，换锚点后推导提示要跟着重算
                refreshStemGhosts()
                renderParadigmBlock()
                refreshGenerateBtn()
            }
        })

        function rebuildRefOptions(initialValue) {
            const pos = posSelect.value
            const opts = collectInflectAnchors(grammarDoc, lang, pos)
            currentOptionsById = Object.fromEntries(opts.map((o) => [o.id, o]))

            // 该语言不启用变格变位表（paradigm: false），或该词性没有任何锚点：
            // 这一行整块隐藏，连「特殊 / 不变」两个内置项也不提供
            // （永远不变格变位的词性谈不上「特殊变格」，也没有「不变格」的对应关系）
            if (grammarDoc?.paradigm === false || !opts.length) {
                inflectionRef.setOptions([])
                inflectionRef.disabled = true
                inflectionRow.hidden = true
                inflectionLabel.value = ''
                data.inflectionType = { label: '', grammarRef: '' }
                renderExtraParts()
                refreshGenerateBtn()
                return
            }

            inflectionRow.hidden = false
            inflectionRef.disabled = false

            const prev = initialValue !== undefined ? initialValue : inflectionRef.value
            const ids = new Set(opts.map((o) => o.id))
            const selected = (prev && ids.has(prev))
                ? prev
                : (prev === INDECL_REF ? INDECL_REF : SPECIAL_REF)

            inflectionRef.setOptions([
                { value: SPECIAL_REF, label: currentTerms().special },
                { value: INDECL_REF, label: currentTerms().indeclinable },
                ...opts.map((o) => ({ value: o.id, label: o.label }))
            ], selected)
            renderExtraParts()
            generateBtn.hidden = !collectInflectAnchors(grammarDoc, lang, posSelect.value).length
            refreshGenerateBtn()
        }

        posSelect.addEventListener('change', () => {
            data.pos = posSelect.value
            // 手动词性切换：下面所有内容都属于旧词性，直接清空
            if (!applyingLookup) clearPosContent()

            const allowed = new Set(getFieldDefs(grammarDoc, data.pos).map((f) => f.key))
            for (const key of Object.keys(data.attributes)) {
                if (!allowed.has(key)) delete data.attributes[key]
            }
            applyTerms()
            updateStemsVisibility()
            rebuildRefOptions()
            renderGenderField()
            renderParadigmBlock()
        })

        /** 换词性后旧内容全部作废 */
        function clearPosContent() {
            data.attributes = {}
            data.inflectionType = { label: '', grammarRef: '' }
            data.stems = { base: '' }
            data.paradigm = {}
            data.inflections = []
            data.collocations = []
            data.examples = []
            data.derivatives = []
            data.meanings = [{ text: '', lang: 'zh', source: 'manual' }]
            data.tags = []
            data.notes = ''

            appliedStems = {}
            autoInflectionLabel = ''
            inflectionLabel.value = ''
            principalInput.value = ''
            lookupStatus.textContent = ''
            lookupStatus.style.color = ''
            setMeaningSource('manual')
            collocationSource = 'manual'
            exampleSource = 'manual'

            renderGenderField()
            renderMeanings()
            renderInflections()
            renderCollocations()
            renderExamples()
            renderDerivatives()
            renderExtras()
            renderParadigmBlock()
            refreshGenerateBtn()
        }

        const inflectionField = createGhostInput({
            value: data.inflectionType.label,
            lang,
            placeholder: currentTerms().inflectionTypePlaceholder
        })
        const inflectionLabel = inflectionField.input

        const principalField = createGhostInput({
            value: data.stems.base || '',
            lang,
            placeholder: currentTerms().stems.placeholder,
            getGhost: () => derivedBase(),
            onInput: () => { refreshStemGhosts(); refreshGenerateBtn() }
        })
        const principalInput = principalField.input
        attachScriptNormalize(principalInput)

        // 额外的词干（由当前变位 / 变格类型的 derive.parts 决定）
        const extraPartsSlot = h('div', { class: 'field__parts' })
        // 额外词干的 ghost input 实例（刷新推导提示时用）
        let extraGhosts = []

        /** 该词性是否用「词干」：没有 paradigm 模板、或模板声明 stems: false 时不用 */
        function updateStemsVisibility() {
            const tpl = getParadigmTemplate(grammarDoc, posSelect.value)
            const needed = grammarDoc?.paradigm !== false && !!tpl && tpl.stems !== false
            stemsBlock.hidden = !needed
            generateBtn.hidden = !collectInflectAnchors(grammarDoc, lang, posSelect.value).length
            if (!needed) {
                for (const key of Object.keys(data.stems)) delete data.stems[key]
                principalInput.value = ''
            }
        }

        const generateBtn = h('button', {
            class: 'btn btn--sm',
            type: 'button',
            onclick: onGenerate
        }, '生成表格')

        /* ---------- 词性自己声明的属性字段（语法性 / 自他…） ---------- */

        const genderSlot = h('div', {})

        /** 词性自己声明的属性（语法性 / 自他 / 助动词…）：多选字段用圆点组，单选字段用下拉 */
        function renderGenderField() {
            genderSlot.replaceChildren()
            const defs = getFieldDefs(grammarDoc, posSelect.value)
            // 没有属性字段的词性，整格隐藏，让后面两栏占满一行
            genderSlot.hidden = defs.length === 0
            if (!defs.length) return

            for (const def of defs) {
                // 必填属性（语法性 / 助动词 / 自他）至少选一个，没值时默认第一项
                const required = def.required === true || def.key === 'gender' || def.declensionCells
                const raw = data.attributes[def.key]
                const picked = Array.isArray(raw) ? raw.filter(Boolean) : (raw ? [raw] : [])
                if (!picked.length && required && def.options.length) {
                    picked.push(def.options[0].value)
                    data.attributes[def.key] = [...picked]
                }

                const control = def.multi
                    ? multiDotField(def, picked, required)
                    : createSelect({
                        lang,
                        className: 'select',
                        value: picked[0] || '',
                        options: [
                            ...(required && picked.length ? [] : [{ value: '', label: '（未选择）' }]),
                            ...def.options.map((opt) => ({ value: opt.value, label: opt.label }))
                        ],
                        onChange: (v) => {
                            if (v) data.attributes[def.key] = v
                            else delete data.attributes[def.key]
                            renderParadigmBlock()
                        }
                    })

                genderSlot.appendChild(field(def.label, control, def.hint || '', lang))
            }
        }

        /** 多选属性：一行圆点，点一下切换；必填字段不允许取消最后一个 */
        function multiDotField(def, picked, required) {
            const values = [...picked]
            const group = h('div', { class: 'dot-group', role: 'group', 'aria-label': def.label })

            const paint = () => {
                group.replaceChildren(...def.options.map((opt) => {
                    const on = values.includes(opt.value)
                    return h('button', {
                        class: 'dot',
                        type: 'button',
                        'aria-pressed': String(on),
                        onclick: () => {
                            const i = values.indexOf(opt.value)
                            if (i >= 0) {
                                if (required && values.length === 1) return
                                values.splice(i, 1)
                            } else {
                                values.push(opt.value)
                            }
                            // 按选项顺序存，导出与展示都稳定
                            const ordered = def.options.map((o) => o.value).filter((v) => values.includes(v))
                            values.length = 0
                            values.push(...ordered)
                            data.attributes[def.key] = [...ordered]
                            paint()
                            renderParadigmBlock()
                        }
                    }, opt.label)
                }))
            }

            paint()
            if (values.length) data.attributes[def.key] = [...values]
            return group
        }

        // 语法锚点下拉：特殊变格/变位 + 语法速查条目

        form.appendChild(h('div', { class: 'word-form__row word-form__card' },
            fieldRow(termNode('lemma.label'), lemmaField.el, {
                extras: [h('span', { class: 'field__hint' }, termNode('lemmaHint'))],
                lang
            }),
            fieldRow(termNode('posLabel'), h('div', { class: 'field__row' },
                posSelect,
                externalSources.length ? lookupBtn : null
            ), { extras: [lookupStatus], target: posSelect })
        ))

        const inflectionTypeLabelEl = h('span', { class: 'field__label' }, currentTerms().inflectionType)
        const inflectionTypeHintEl = h('span', { class: 'field__hint' }, hintText(currentTerms().inflectionTypeHint))
        const anchorHintEl = h('span', { class: 'field__hint' }, hintText(currentTerms().anchorHint))
        // 语法性之类的属性 + 类型 + 锚点：一行放不下时自适应换行
        const inflectionRow = h('div', { class: 'word-form__panel' },
            genderSlot,
            fieldRow(termNode('anchorLabel'), inflectionRef, { extras: [anchorHintEl] }),
            fieldRow(inflectionTypeLabelEl, inflectionField.el, { extras: [inflectionTypeHintEl] })
        )

        const stemsLabelEl = h('span', { class: 'field__label' }, currentTerms().stems.label)
        const stemsHintEl = h('span', { class: 'field__hint' }, hintText(currentTerms().stems.hint))
        const stemsRow = fieldRow(stemsLabelEl, h('div', { class: 'field__row' }, principalField.el, generateBtn), {
            extras: [stemsHintEl],
            target: principalInput
        })

        // 词干 + 额外词干：放在变格 / 变位表头顶
        const stemsBlock = h('div', { class: 'word-form__stems' }, stemsRow, extraPartsSlot)

        // 字段顺序：基本形态+词性 → 属性/类型/锚点 → 含义 → 变格变位表（含词干）
        form.appendChild(inflectionRow)
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

        // 预览：把当前填的内容直接当成一张词卡打开（词卡自带「显示转写」开关）
        const previewBtn = h('button', {
            class: 'btn',
            type: 'button',
            onclick: onPreview
        }, '预览')
        // 没有基本形态就没什么可预览的
        const syncPreview = () => { previewBtn.disabled = !lemmaInput.value.trim() }
        lemmaField.input.addEventListener('input', syncPreview)
        syncPreview()

        if (isEdit) {
            form.appendChild(h('div', { class: 'word-form__actions' },
                h('button', {
                    class: 'btn btn--danger',
                    type: 'button',
                    onclick: onDelete
                }, '删除'),
                h('div', { style: { flex: 1 } }),
                cancelBtn,
                previewBtn,
                submitBtn
            ))
        } else {
            form.appendChild(h('div', { class: 'word-form__actions' },
                cancelBtn,
                previewBtn,
                submitBtn
            ))
        }


        /* ---------- 右下角浮动工具：回到顶部 + 显示转写 ---------- */
        const toRoman = typeof scriptProfile?.toRoman === 'function'
            ? (text) => scriptProfile.toRoman(text)
            : null
        const scriptRange = toRoman && scriptProfile?.scriptRange instanceof RegExp
            ? scriptProfile.scriptRange
            : null

        /** 表单里能加注的原文只有「推导出来的词干」这类提示文字 */
        function annotateForm() {
            if (!toRoman || !scriptRange) return
            annotateDualText(form, { range: scriptRange, toRoman, selector: '.ghost-input__hint' })
        }

        const pageTools = createPageTools({
            lang,
            toRoman,
            anchorEl: main,
            onChange: (on) => {
                setDualTextVisible(on)
                if (on) annotateForm()
            },
            onBreveChange: (on) => {
                setBreveVisible(on)
                annotateBreves(form, { selector: '.ghost-input__hint' })
            }
        })
        document.body.appendChild(pageTools.el)
        if (pageTools.isOn() && toRoman) {
            setDualTextVisible(true)
            annotateForm()
        }
        if (pageTools.isBreveOn()) setBreveVisible(true)

        rebuildRefOptions(data.inflectionType.grammarRef || SPECIAL_REF)
        replace(main, head, form)

        renderGenderField()
        updateStemsVisibility()
        renderParadigmBlock()
        refreshStemGhosts()
        refreshGenerateBtn()
        refreshLookupBtn()

        /* ---------- 按词干生成表格 ---------- */

        /** 当前「变格 / 变位类型」对应的生成规则 */
        function currentDeriveSpec() {
            const ref = inflectionRef.value
            if (!ref || ref === INDECL_REF) return null
            // 「特殊」也回退到词性的总规则，这样还能拿到声明的词干（如法语动词的助动词）；
            // 没有 endings 的总规则只用来渲染词干，不参与生成
            if (ref === SPECIAL_REF) return getDeriveSpec(grammarDoc, `${lang}-${posSelect.value}`)
            // 锚点自己没写规则时，退回该词性的总规则（如希伯来语名词：按基本形态判定元音模式）
            return getDeriveSpec(grammarDoc, ref) || getDeriveSpec(grammarDoc, `${lang}-${posSelect.value}`)
        }

        /** 当前锚点声明的 base 词干（可自带标题 / placeholder / 提示） */
        function currentBasePart() {
            const spec = currentDeriveSpec()
            if (!spec || !Array.isArray(spec.parts)) return null
            return spec.parts.find((part) => part && part.key === 'base') || null
        }

        /** 主词干的文案：锚点给 base 声明了 label / placeholder / hint 时优先用它 */
        function refreshStemsText() {
            const t = currentTerms()
            const base = currentBasePart()
            lemmaInput.placeholder = t.lemma.placeholder
            stemsLabelEl.textContent = base?.label || t.stems.label
            stemsHintEl.replaceChildren(hintText(base?.hint || t.stems.hint))
            principalInput.placeholder = base?.placeholder || t.stems.placeholder
        }

        /** 当前锚点声明的词干（不含 base） */
        function currentParts() {
            const spec = currentDeriveSpec()
            if (!spec || !Array.isArray(spec.parts)) return []
            return spec.parts.filter((part) => part && part.key && part.key !== 'base')
        }

        /** 按当前锚点重建额外词干输入框；已填但新类型没有声明的部分丢弃 */
        function renderExtraParts() {
            extraGhosts = []
            refreshStemsText()
            const parts = currentParts()
            const allowed = new Set(['base', ...parts.map((p) => p.key)])
            for (const key of Object.keys(data.stems)) {
                if (!allowed.has(key)) delete data.stems[key]
            }

            extraPartsSlot.replaceChildren()
            // 锚点没有额外词干时也要刷新推导提示：la 的一、二变格只声明 stemForms 没有 parts
            if (!parts.length) {
                refreshStemGhosts()
                return
            }

            extraPartsSlot.appendChild(h('div', { class: 'field__hint' },
                hintText(currentTerms().extraPartsHint)))

            for (const part of parts) {
                const setValue = (raw) => {
                    const value = String(raw ?? '').trim()
                    if (value) data.stems[part.key] = value
                    else delete data.stems[part.key]
                    refreshStemGhosts()
                    refreshGenerateBtn()
                    // 有别的字段依赖这个下拉的值显隐时，重建一次额外词干区
                    if (part.kind === 'select'
                        && currentParts().some((p) => p.showWhen && p.showWhen[part.key] !== undefined)) {
                        renderExtraParts()
                    }
                }
                // kind: 'select' —— 非词干类的元数据（如德语的助动词 haben / sein / beide）。
                // 这类字段没有空选项：没值时默认第一项并写进数据（助动词默认 haben / avoir）。
                const selectOptions = (part.options || [])
                    .map((opt) => ({ value: String(opt), label: String(opt) }))
                if (part.kind === 'select' && selectOptions.length && !data.stems[part.key]) {
                    data.stems[part.key] = selectOptions[0].value
                }
                const input = part.kind === 'select'
                    ? createSelect({
                        lang,
                        className: 'select',
                        value: data.stems[part.key] || '',
                        options: selectOptions,
                        onChange: (v) => setValue(v)
                    })
                    : ((ghost) => {
                        extraGhosts.push(ghost)
                        attachScriptNormalize(ghost.input)
                        return ghost
                    })(createGhostInput({
                        value: data.stems[part.key] || '',
                        lang,
                        dataset: { partKey: part.key },
                        getGhost: () => derivedPart(part.key),
                        onInput: (e) => {
                            setValue(normalizeStem(e.target.value))
                            refreshStemGhosts()
                        }
                    })).el
                const visible = !part.showWhen
                    || Object.entries(part.showWhen).every(([k, v]) => data.stems[k] === v)
                const partField = fieldRow(part.label || part.key, input, {
                    className: 'field--part',
                    extras: [part.hint ? h('span', { class: 'field__hint' }, hintText(part.hint)) : null]
                })
                partField.hidden = !visible
                extraPartsSlot.appendChild(partField)
            }
            refreshStemGhosts()
        }

        /** 推导结果是 IAST；界面与存储都用原文（天城文） */
        function toScriptText(value) {
            if (!value || typeof scriptProfile?.toScript !== 'function') return value
            return String(scriptProfile.toScript(value) ?? value)
        }

        /** 保存前把词干统一成原文：用户可能直接敲了转写，下拉类的元数据（如助动词）不转 */
        function toScriptStems(stems) {
            if (typeof scriptProfile?.toScript !== 'function') return stems
            const metaKeys = new Set(currentParts().filter((p) => p.kind === 'select').map((p) => p.key))
            const out = {}
            for (const [key, value] of Object.entries(stems)) {
                out[key] = (typeof value === 'string' && value && !metaKeys.has(key))
                    ? toScriptText(value)
                    : value
            }
            return out
        }

        /** 生成 / 推导都在 IAST 上做；用户输入的是天城文，先转写再交给引擎 */
        function romanStems(stems) {
            if (typeof scriptProfile?.toRoman !== 'function') return stems
            const metaKeys = new Set(currentParts().filter((p) => p.kind === 'select').map((p) => p.key))
            const out = { ...stems }
            for (const [key, value] of Object.entries(out)) {
                if (typeof value === 'string' && value && !metaKeys.has(key)) {
                    out[key] = String(scriptProfile.toRoman(value) ?? value)
                }
            }
            return out
        }

        /** 由基本形态 + 规则推出的词干（不含用户已填的 base） */
        function derivedBase() {
            const spec = currentDeriveSpec()
            if (!spec) return ''
            const stems = collectStems()
            delete stems.base
            const headword = normalizeStem(lemmaInput.value)
            return toScriptText(previewStem('', 'base', spec, { ...romanStems(stems), headword }, paradigmProfile))
        }

        /** 某个补充词干的推导值（忽略该框自己已填的内容） */
        function derivedPart(key) {
            const spec = currentDeriveSpec()
            if (!spec) return ''
            const stems = collectStems()
            delete stems[key]
            const headword = normalizeStem(lemmaInput.value)
            const roman = romanStems(stems)
            return toScriptText(previewStem(roman.base || '', key, spec, { ...roman, headword }, paradigmProfile))
        }

        /** 刷新所有词干输入框上的「推导提示」 */
        function refreshStemGhosts() {
            principalField.refresh()
            for (const item of extraGhosts) item.refresh()
            annotateForm()
            annotateBreves(form, { selector: '.ghost-input__hint' })
        }

        /** 收集词干：base + 已填的额外部分 */
        function collectStems() {
            const stems = {}
            const base = normalizeStem(principalInput.value)
            if (base) stems.base = base
            for (const [key, value] of Object.entries(data.stems)) {
                if (key !== 'base' && value) stems[key] = normalizeStem(value)
            }
            return stems
        }

        /** 该词干变体是否能由规则/基本形态自动推出（空规则数组 `[]` 表示推不出） */
        function hasStemRule(form) {
            if (!form) return false
            if (typeof form === 'string') return !!form.trim()
            if (Array.isArray(form)) return form.length > 0
            if (typeof form === 'object') {
                if (form.from) return true
                return Array.isArray(form.rules) && form.rules.length > 0
            }
            return false
        }

        /** 必填但还没填的词干（有规则能自动推出的不算） */
        function missingRequiredParts(spec) {
            if (!spec || !Array.isArray(spec.parts)) return []
            return spec.parts
                .filter((part) => part && part.required === true && part.key !== 'base')
                .filter((part) => !hasStemRule(spec.stemForms && spec.stemForms[part.key]))
                .filter((part) => !(spec.stems && typeof spec.stems[part.key] === 'string'))
                .filter((part) => !String(data.stems[part.key] || '').trim())
                .map((part) => part.label || part.key)
        }

        function refreshGenerateBtn() {
            const spec = currentDeriveSpec()
            const canGenerate = !!spec && !!spec.endings && Object.keys(spec.endings).length > 0
            const hasStem = !!normalizeStem(principalInput.value) || !!derivedBase()
            const missing = missingRequiredParts(spec)
            generateBtn.disabled = !canGenerate || !hasStem || missing.length > 0
            if (!canGenerate) generateBtn.title = '该变格 / 变位类型还没有自动生成规则'
            else if (!hasStem) generateBtn.title = '请先填写词干'
            else if (missing.length) generateBtn.title = `请先填写：${missing.join('、')}`
            else generateBtn.title = '按词干和词尾规则自动填表（会覆盖已填内容）'
            return missing
        }

        function onGenerate() {
            const spec = currentDeriveSpec()
            // partsOnly 的规则只提供词干，没有 endings，不能用来生成表格
            if (!spec || !spec.endings || !Object.keys(spec.endings).length) return

            // 没有「词干」输入框的语言（日语）：直接用基本形态推导出的 base
            const stem = normalizeStem(principalInput.value) || derivedBase()
            if (!stem) {
                toast.error(stemsBlock.hidden ? '请先填写基本形态' : '请先填写词干')
                if (!stemsBlock.hidden) principalInput.focus()
                else lemmaInput.focus()
                return
            }
            const missing = missingRequiredParts(spec)
            if (missing.length) {
                toast.error(`请先填写：${missing.join('、')}`, 5000)
                return
            }

            // 先把能推导出来的补充词干回填到输入框（生成时也用同一套值）
            {
                const headword = normalizeStem(lemmaInput.value)
                const filledParts = []
                const currentStems = collectStems()
                for (const part of currentParts()) {
                    if (String(data.stems[part.key] ?? '').trim()) continue
                    const roman = romanStems(currentStems)
                    const value = previewStem(roman.base || '', part.key, spec,
                        { ...roman, headword }, paradigmProfile)
                    if (!value) continue
                    data.stems[part.key] = toScriptText(value)
                    filledParts.push(part.key)
                }
                if (filledParts.length) renderExtraParts()
            }

            const tpl = getParadigmTemplate(grammarDoc, data.pos)
            const { paradigm, filled, noVariant, skippedTables, usedTables } = generateParadigm({
                stem,
                stems: toScriptStems(collectStems()),
                headword: lemmaInput.value,
                spec,
                template: tpl,
                existing: {},
                overwrite: true,
                profile: paradigmProfile,
                script: scriptProfile
            })

            if (noVariant) {
                toast.error('按基本形态判不出元音模式，请检查基本形态的元音点，或手动填表', 6000)
                return
            }

            // 本次生成覆盖有规则的表；完全没有规则的表（如未选类型的不定过去时 / 完成时）
            // 保留手填内容，避免点一次「生成表格」就把它们清空
            const used = new Set(usedTables || [])
            const next = { ...paradigm }
            for (const [tableKey, rows] of Object.entries(data.paradigm || {})) {
                if (used.has(tableKey) || !rows || typeof rows !== 'object') continue
                if (!next[tableKey]) next[tableKey] = {}
                for (const [rowKey, cells] of Object.entries(rows)) {
                    if (!cells || typeof cells !== 'object') continue
                    next[tableKey][rowKey] = { ...(next[tableKey][rowKey] || {}), ...cells }
                }
            }
            data.paradigm = next

            renderParadigmBlock()

            const titleOf = (tableKey) => (tpl?.tables || []).find((t) => t.key === tableKey)?.title || tableKey
            if (skippedTables.length) {
                const detail = skippedTables
                    .map((x) => `${titleOf(x.tableKey)}（缺 ${x.missing.join('、')}）`)
                    .join('、')
                toast.info(`已生成 ${filled.length} 格；以下表格因缺少词干，未生成并已清空：${detail}`, 8000)
            } else {
                toast.success(`已生成 ${filled.length} 格（已覆盖原有内容），请确认无误后保存`, 5000)
            }
        }

        /* ---------- 表格块渲染 ---------- */

        /** 只渲染所选「语法性」对应的格子：对不上的列 / 行都不渲染（性可能写在列上，也可能写在行上） */
        function hiddenGenderCells(tpl) {
            const empty = { columns: [], rows: [] }
            const field = fieldDefsOfTemplate(tpl, data.pos).find((f) => f.declensionCells)
            if (!field) return empty
            const raw = data.attributes[field.key]
            const picked = Array.isArray(raw) ? raw : (raw ? [raw] : [])
            if (!picked.length) return empty
            const hidden = { columns: [], rows: [] }
            for (const table of tpl?.tables || []) {
                for (const col of table.columns || []) {
                    const g = genderOfColumn(col.key)
                    if (g && !picked.includes(g)) hidden.columns.push(col.key)
                }
                for (const row of table.rows || []) {
                    const g = genderOfRow(row.key)
                    if (g && !picked.includes(g)) hidden.rows.push(row.key)
                }
            }
            return hidden
        }

        function renderParadigmBlock() {
            paradigmSlot.replaceChildren()
            if (grammarDoc?.paradigm === false) return
            // 选了「不变格 / 不变形 / 不变位」：没有变化表可填，整块（词干、标题、表格、横线）都不渲染
            if (inflectionRef.value === INDECL_REF) {
                paradigmSlot.hidden = true
                return
            }
            paradigmSlot.hidden = false
            const tpl = getParadigmTemplate(grammarDoc, data.pos)
            if (!tpl) return

            // 锚点的 derive.skipTables：该类型没有的语式（如情态动词没有命令式）不渲染表格
            const spec = currentDeriveSpec()
            const skip = Array.isArray(spec?.skipTables) ? spec.skipTables : []

            const titleRow = h('div', { class: 'word-form__group-title' },
                h('span', {}, fillTerms(currentTerms().paradigmTitle, posLabel(data.pos)))
            )

            // 表可以声明 anchors：只在该锚点被选中时显示（代词的有性 / 无性表）
            // 模板里有表声明了 anchors 时，没选锚点（特殊 / 不变）只显示 default 的那张
            const ref = inflectionRef.value
            const anchored = (tpl.tables || []).some((t) => Array.isArray(t?.anchors))
            const noAnchor = !ref || ref === SPECIAL_REF || ref === INDECL_REF
            let tables = (tpl.tables || []).filter((t) => {
                if (skip.includes(t.key)) return false
                if (!anchored) return true
                if (!noAnchor && Array.isArray(t.anchors)) return t.anchors.includes(ref)
                return t.default === true
            })
            // 锚点没匹配到任何表（如选了父级代词、或数据没写全）时退回默认表
            if (!tables.length && anchored) {
                tables = (tpl.tables || []).filter((t) => t.default === true && !skip.includes(t.key))
            }
            // 这个锚点没有表格、也没有词干可填（如日语形容动词）：整块不渲染
            if (!tables.length && stemsBlock.hidden) {
                paradigmSlot.hidden = true
                return
            }

            // 只有一张表时，标题行直接占掉表格自带的标题位置（表格不再重复一遍）
            const singleTable = tables.length <= 1

            // 这个锚点没有对应的表（如代词的「特殊变形」）：只留词干，不画光秃秃的标题
            const wrap = h('div', { class: 'word-form__group' }, stemsBlock,
                tables.length ? titleRow : null)

            const panels = []
            const hiddenGender = hiddenGenderCells(tpl)
            for (const tableTpl of tables) {
                const tableData = data.paradigm[tableTpl.key] || {}
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang,
                    mode: 'edit',
                    // 单表用上面的标题行，多表用 tab 名，表内不再重复标题
                    showTitle: false,
                    hideColumns: hiddenGender.columns,
                    hideRows: hiddenGender.rows,
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
                if (tbl) panels.push({ key: tableTpl.key, label: tableTpl.title || tableTpl.key, node: tbl })
            }

            // 多张表用 tab 切换（输入内容在各表自己的数据里，切换不会丢）
            if (panels.length > 1) {
                if (!panels.some((p) => p.key === paradigmTab)) paradigmTab = panels[0].key
                wrap.appendChild(createTabGroup({
                    items: panels,
                    active: paradigmTab,
                    onChange: (key) => { paradigmTab = key },
                    className: 'tab-bar--tables'
                }).el)
            } else if (panels.length === 1) {
                wrap.appendChild(panels[0].node)
            }

            wrap.appendChild(h('div', { class: 'field__hint word-form__table-hint' },
                termNode('paradigmHint')))

            paradigmSlot.appendChild(wrap)
        }

        /* ---------- 外部数据源查询（config.EXTERNAL_SOURCES） ---------- */

        /** 把查到的词条回填到表单：词性 / 属性 / 类型 / 锚点 / 词干 / 含义 */
        function applyEntry(entry, entries) {
            applyingLookup = true
            try {
                fillEntry(entry, entries)
            } finally {
                applyingLookup = false
            }
        }

        function fillEntry(entry, entries) {
            if (entry.pos && entry.pos !== posSelect.value) {
                // 借 change 事件走一遍词性切换的连带刷新（属性 / 锚点 / 表格）
                posSelect.value = entry.pos
                posSelect.dispatchEvent(new Event('change'))
            }

            const defs = getFieldDefs(grammarDoc, posSelect.value)
            const allowed = new Map(defs.map((f) => [f.key, f]))
            for (const [key, value] of Object.entries(entry.patch.attributes || {})) {
                const def = allowed.get(key)
                if (!def) continue
                const list = (Array.isArray(value) ? value : [value])
                    .map((v) => String(v ?? '').trim())
                    .filter(Boolean)
                if (!list.length) continue
                // 多选字段存数组，单选字段存字符串
                data.attributes[key] = def.multi ? list : list[0]
            }
            renderGenderField()

            applyInflectionType(entry.patch.inflectionType)

            if (!stemsBlock.hidden) applyStems(entry.patch.stems)

            // 含义：所有来源里「同一个词性」的条目，各写进自己的来源
            const bySource = new Map()
            for (const e of entries) {
                if (e.pos !== entry.pos || bySource.has(e.sourceId)) continue
                if (e.patch.meanings?.length) bySource.set(e.sourceId, e.patch)
            }
            for (const [sourceId, patch] of bySource) {
                const items = patch.meanings.map((m) => ({
                    text: m.text,
                    lang: m.lang || 'en',
                    source: sourceId
                }))
                data.meanings = data.meanings.filter((m) => (m.source || 'manual') !== sourceId)
                data.meanings.push(...items)
            }
            if (!data.meanings.length) {
                data.meanings.push({ text: '', lang: 'zh', source: 'manual' })
            }
            setMeaningSource(entry.sourceId)
            renderMeanings()
            // 属性（如语法性）变了要重画表格的列
            renderParadigmBlock()
        }

        /** 上一次查询填进去的词干（换词条时先撤掉，免得残留上一个词性的词干） */
        let appliedStems = {}

        function applyStems(stems) {
            for (const [key, value] of Object.entries(appliedStems)) {
                if (data.stems[key] === value) delete data.stems[key]
            }
            appliedStems = {}

            for (const [key, value] of Object.entries(stems || {})) {
                const stem = normalizeStem(value)
                if (!stem) continue
                data.stems[key] = stem
                appliedStems[key] = stem
            }

            principalInput.value = data.stems.base || ''
            renderExtraParts()
            refreshGenerateBtn()
        }

        /** 类型与锚点：只在没手改过文案时才覆盖 */
        function applyInflectionType(inflectionType) {
            const ref = inflectionType?.grammarRef
            if (!ref || !currentOptionsById[ref]) {
                // 新词条没有可靠锚点：撤掉上次自动填的类型文案
                if (autoInflectionLabel && inflectionLabel.value.trim() === autoInflectionLabel) {
                    inflectionLabel.value = ''
                }
                autoInflectionLabel = ''
                return
            }

            rebuildRefOptions(ref)
            const current = inflectionLabel.value.trim()
            if (!current || current === autoInflectionLabel) {
                autoInflectionLabel = inflectionType.label || currentOptionsById[ref].short || ''
                inflectionLabel.value = autoInflectionLabel
            }
            renderExtraParts()
        }

        /** 多个候选（多词性 / 多来源）时，弹窗让用户选一个 */
        function chooseEntry(entries, initial) {
            return new Promise((resolve) => {
                let picked = initial

                const items = entries.map((entry) => {
                    const btn = h('button', {
                        class: 'lookup-choice' + (entry === picked ? ' lookup-choice--active' : ''),
                        type: 'button',
                        onclick: () => {
                            picked = entry
                            for (const other of items) {
                                other.classList.toggle('lookup-choice--active', other === btn)
                            }
                        }
                    },
                    h('span', { class: 'lookup-choice__pos' }, posLabel(entry.pos)),
                    h('span', { class: 'lookup-choice__source' }, entry.sourceLabel),
                    h('span', { class: 'lookup-choice__label' }, entry.label)
                    )
                    return btn
                })

                openModal({
                    title: '选择词条',
                    body: h('div', {},
                        h('div', { class: 'field__hint' }, hintText('这一页有多个词条，选一个用来回填')),
                        h('div', { class: 'lookup-choices' }, ...items)
                    ),
                    actions: [
                        { label: '取消', onClick: () => resolve(null) },
                        { label: '使用所选', className: 'btn--primary', onClick: () => resolve(picked) }
                    ],
                    onClose: () => resolve(null)
                })
            })
        }

        async function onLookupAll() {
            const lemma = lemmaInput.value.trim()
            if (!lemma) {
                toast.error('请先输入基本形态')
                lemmaInput.focus()
                return
            }
            if (!externalSources.length) return

            lookupBtn.disabled = true
            lookupStatus.textContent = '查询中…'
            lookupStatus.style.color = ''

            try {
                const settled = await Promise.all(externalSources.map(async (source) => {
                    try {
                        const patch = await source.lookupWordForForm({
                            lemma,
                            langCode: lang,
                            preferredPos: posSelect.value,
                            grammarDoc
                        })
                        return { source, patch }
                    } catch (err) {
                        console.error(`[external] ${source.id}`, err)
                        return { source, error: err }
                    }
                }))

                const entries = []
                for (const { source, patch } of settled) {
                    if (!patch) continue
                    const choices = Array.isArray(patch.choices) && patch.choices.length
                        ? patch.choices
                        : [{ label: source.label, patch }]
                    for (const choice of choices) {
                        if (!choice?.patch) continue
                        entries.push({
                            sourceId: source.id,
                            sourceLabel: source.label,
                            pos: choice.patch.pos,
                            label: choice.label || source.label,
                            patch: choice.patch
                        })
                    }
                }

                if (!entries.length) {
                    lookupStatus.textContent = '所有来源都没有找到该词条'
                    lookupStatus.style.color = 'var(--c-fg-subtle)'
                    return
                }

                let picked = entries.find((e) => e.pos === posSelect.value) || entries[0]
                if (entries.length > 1) {
                    picked = await chooseEntry(entries, picked)
                    if (!picked) {
                        lookupStatus.textContent = '已取消'
                        lookupStatus.style.color = 'var(--c-fg-subtle)'
                        return
                    }
                }

                applyEntry(picked, entries)
                lookupStatus.textContent = `已从 ${picked.sourceLabel} 获取：${posLabel(picked.pos)}`
                lookupStatus.style.color = 'var(--c-success)'
                toast.success(`已从 ${picked.sourceLabel} 获取「${lemma}」`)
            } catch (err) {
                console.error(err)
                lookupStatus.textContent = `查询失败：${err.message}`
                lookupStatus.style.color = 'var(--c-danger)'
                toast.error(`查询失败：${err.message}`)
            } finally {
                lookupBtn.disabled = false
            }
        }

        /* ---------- 其余分组 ---------- */

        /** 「含义」按来源分 tab：手动 + 各外部源；切换只影响这一块 */
        function buildMeaningGroup() {
            const tabs = h('div', { class: 'source-tabs word-form__meaning-tabs' })
            const list = h('div', { class: 'word-form__list' })
            const empty = h('div', { class: 'field__hint' }, termNode('emptyMeanings'))

            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    termNode('meanings'),
                    h('button', {
                        class: 'btn btn--sm', type: 'button',
                        onclick: () => {
                            data.meanings.push({ text: '', lang: 'zh', source: meaningSource })
                            renderMeanings()
                        }
                    }, currentTerms().addMeaning)
                ),
                tabs,
                empty,
                list
            )

            /** tab 列表：手动 → 已注册的外部源 → 数据里出现的其它来源 */
            function meaningSources() {
                const ids = ['manual', ...externalSources.map((s) => s.id)]
                for (const m of data.meanings) {
                    const src = m.source || 'manual'
                    if (!ids.includes(src)) ids.push(src)
                }
                return ids
            }

            function renderTabs() {
                tabs.replaceChildren(...meaningSources().map((id) => h('button', {
                    class: 'source-tab' + (id === meaningSource ? ' source-tab--active' : ''),
                    type: 'button',
                    role: 'tab',
                    'aria-selected': String(id === meaningSource),
                    onclick: () => {
                        if (id === meaningSource) return
                        meaningSource = id
                        renderMeanings()
                        // 例句里的含义引用按当前来源决定是否加前缀，跟着一起刷新
                        renderExamples()
                    }
                },
                sourceLabel(id)
                )))
            }

            setMeaningSource = (id) => {
                if (!id || id === meaningSource) return
                meaningSource = id
                renderTabs()
                renderExamples()
            }

            renderMeanings = function () {
                renderTabs()
                list.replaceChildren()

                const rows = data.meanings
                    .map((m, idx) => ({ m, idx }))
                    .filter(({ m }) => (m.source || 'manual') === meaningSource)

                empty.hidden = rows.length > 0

                const renumber = () => renumberItems(list, (i) => String(rows[i]?.m.text || '').trim() !== '')

                rows.forEach(({ m, idx }, order) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--meaning' },
                        indexCell(),
                        createGhostInput({
                            value: m.text,
                            lang: m.lang === 'en' ? 'en' : null,
                            bdiLang: lang,
                            placeholder: currentTerms().meaningPlaceholder,
                            onInput: (e) => {
                                m.text = e.target.value
                                renumber()
                            }
                        }).el,
                        h('select', {
                            class: 'select',
                            onchange: (e) => { m.lang = e.target.value }
                        },
                        h('option', { value: 'zh', selected: m.lang === 'zh' }, '中文'),
                        h('option', { value: 'en', selected: m.lang === 'en' }, 'English')
                        ),
                        h('button', {
                            class: 'btn btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该含义',
                            onclick: () => {
                                data.meanings.splice(idx, 1)
                                if (!data.meanings.length) {
                                    data.meanings.push({ text: '', lang: 'zh', source: 'manual' })
                                }
                                renderMeanings()
                            }
                        }, '✕')
                    ))
                })
                renumber()
            }
            renderMeanings()
            return group
        }

        function buildInflectionGroup() {
            const list = h('div', { class: 'word-form__list' })
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    h('span', { class: 'js-extra-forms-title' }, currentTerms().extraForms),
                    h('button', {
                        class: 'btn btn--sm', type: 'button',
                        onclick: () => {
                            data.inflections.push({ group: '', label: '', form: '' })
                            renderInflections()
                        }
                    }, currentTerms().add)
                ),
                list
            )

            const renumber = () => renumberItems(list, (i) => String(data.inflections[i]?.form || '').trim() !== '')

            renderInflections = function () {
                list.replaceChildren()
                data.inflections.forEach((it, idx) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--inflection' },
                        indexCell(),
                        h('input', {
                            class: 'input', placeholder: currentTerms().inflectionGroupPlaceholder, value: it.group || '',
                            oninput: (e) => { it.group = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: currentTerms().inflectionLabelPlaceholder, value: it.label,
                            oninput: (e) => { it.label = e.target.value }
                        }),
                        ((f) => { attachScriptNormalize(f.input); return f.el })(createGhostInput({
                            value: it.form,
                            lang,
                            placeholder: currentTerms().inflectionFormPlaceholder,
                            onInput: (e) => {
                                it.form = e.target.value
                                renumber()
                            }
                        })),
                        h('button', {
                            class: 'btn btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该形式',
                            onclick: () => {
                                data.inflections.splice(idx, 1)
                                renderInflections()
                            }
                        }, '✕')
                    ))
                })
                renumber()
            }
            renderInflections()
            return group
        }

        function buildCollocationGroup() {
            const tabs = h('div', {})
            const list = h('div', { class: 'word-form__list' })
            const empty = h('div', { class: 'field__hint' }, termNode('emptyCollocations'))

            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    termNode('collocations', 'optionalSuffix'),
                    h('button', {
                        class: 'btn btn--sm', type: 'button',
                        onclick: () => {
                            data.collocations.push({ text: '', gloss: '', source: collocationSource })
                            render()
                        }
                    }, currentTerms().add)
                ),
                tabs,
                empty,
                list
            )

            let rows = []

            function render() {
                tabs.replaceChildren(sourceTabBar({
                    items: data.collocations,
                    active: collocationSource,
                    onPick: (id) => { collocationSource = id; render() }
                }))
                list.replaceChildren()
                rows = data.collocations
                    .map((it, idx) => ({ it, idx }))
                    .filter(({ it }) => (it.source || 'manual') === collocationSource)
                empty.hidden = rows.length > 0
                rows.forEach(({ it, idx }) => {
                    list.appendChild(h('div', { class: 'word-form__item' },
                        indexCell(),
                        ((f) => { attachScriptNormalize(f.input); return f.el })(createGhostInput({
                            value: it.text,
                            lang,
                            placeholder: currentTerms().collocationTextPlaceholder,
                            onInput: (e) => {
                                it.text = e.target.value
                                renumberItems(list, (i) => String(rows[i]?.it.text || '').trim() !== '')
                            }
                        })),
                        h('input', {
                            class: 'input', placeholder: currentTerms().collocationGlossPlaceholder, value: it.gloss,
                            oninput: (e) => { it.gloss = e.target.value }
                        }),
                        h('button', {
                            class: 'btn btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该搭配',
                            onclick: () => { data.collocations.splice(idx, 1); render() }
                        }, '✕')
                    ))
                })
                renumberItems(list, (i) => String(rows[i]?.it.text || '').trim() !== '')
            }
            renderCollocations = render
            render()
            return group
        }

        /* ---------- 例句关联的含义：按来源分组，序号与该来源 tab 里显示的一致 ---------- */

        function meaningOptions() {
            const sources = []
            for (const m of data.meanings) {
                const id = m.source || 'manual'
                if (!sources.includes(id)) sources.push(id)
            }
            const options = [{ value: '', label: '不关联含义' }]
            for (const id of sources) {
                // 与含义 tab 里的行号同一套：空白行不占号
                let order = 0
                for (const m of meaningsOfSource(data.meanings, id)) {
                    const text = String(m.text || '').trim()
                    if (!text) continue
                    order += 1
                    const ref = { source: id, text }
                    options.push({
                        value: exampleMeaningValue(ref),
                        label: `${order}. ${text}`,
                        // 收起态补上来源名：跨 tab 引用时序号才有出处可对
                        display: meaningRefLabel(ref, data.meanings, meaningSource),
                        group: sourceLabel(id)
                    })
                }
            }
            return options
        }

        /** 某条例句的可选含义；关联的那条后来被删 / 改名时，仍按原文本留一个条目，别悄悄改成「不关联」 */
        function meaningOptionsOf(example) {
            const options = meaningOptions()
            const value = exampleMeaningValue(example.meaning)
            if (value && !options.some((o) => o.value === value)) {
                options.push({
                    value,
                    label: meaningRefLabel(example.meaning, data.meanings, meaningSource),
                    title: String(example.meaning.text || '')
                })
            }
            return options
        }

        /** 下拉存的是「来源 + 文本」快照，不是序号：含义调序不会指错，删了也不至于张冠李戴 */
        function exampleMeaningValue(ref) {
            const text = String(ref?.text || '').trim()
            return text ? JSON.stringify({ source: ref.source || 'manual', text }) : ''
        }

        function readExampleMeaning(value) {
            if (!value) return { text: '', source: 'manual' }
            try {
                const parsed = JSON.parse(value)
                return { text: String(parsed.text || ''), source: parsed.source || 'manual' }
            } catch {
                return { text: '', source: 'manual' }
            }
        }

        function buildExampleGroup() {
            const tabs = h('div', {})
            const list = h('div', { class: 'word-form__list' })
            const empty = h('div', { class: 'field__hint' }, termNode('emptyExamples'))
            const group = h('div', { class: 'word-form__group' },
                h('div', { class: 'word-form__group-title' },
                    termNode('examples', 'optionalSuffix'),
                    h('button', {
                        class: 'btn btn--sm', type: 'button',
                        onclick: () => {
                            data.examples.push({ text: '', translation: '', citation: '', source: exampleSource })
                            renderExamples()
                        }
                    }, currentTerms().add)
                ),
                tabs,
                empty,
                list
            )

            let rows = []

            renderExamples = function () {
                tabs.replaceChildren(sourceTabBar({
                    items: data.examples,
                    active: exampleSource,
                    onPick: (id) => {
                        exampleSource = id
                        // 含义 tab 决定例句里含义引用的来源前缀，切例句 tab 时把这些引用一起刷新
                        renderExamples()
                    }
                }))
                list.replaceChildren()
                rows = data.examples
                    .map((it, idx) => ({ it, idx }))
                    .filter(({ it }) => (it.source || 'manual') === exampleSource)
                empty.hidden = rows.length > 0
                rows.forEach(({ it, idx }) => {
                    list.appendChild(h('div', { class: 'word-form__item word-form__item--example' },
                        indexCell(),
                        ((f) => { attachScriptNormalize(f.input); return f.el })(createGhostInput({
                            value: it.text,
                            lang,
                            placeholder: currentTerms().exampleTextPlaceholder,
                            onInput: (e) => {
                                it.text = e.target.value
                                renumberItems(list, (i) => String(rows[i]?.it.text || '').trim() !== '')
                            }
                        })),
                        h('input', {
                            class: 'input', placeholder: currentTerms().exampleCitationPlaceholder, value: it.citation,
                            oninput: (e) => { it.citation = e.target.value }
                        }),
                        h('input', {
                            class: 'input word-form__cell--translation', placeholder: currentTerms().exampleTranslationPlaceholder, value: it.translation,
                            oninput: (e) => { it.translation = e.target.value }
                        }),
                        createSelect({
                            lang,
                            className: 'select word-form__cell--meaning',
                            value: exampleMeaningValue(it.meaning),
                            // 含义随时会增删，选项在每次展开时重算
                            options: () => meaningOptionsOf(it),
                            nowrap: true,
                            onChange: (v) => { it.meaning = readExampleMeaning(v) }
                        }),
                        h('button', {
                            class: 'btn btn--sm word-form__cell--remove', type: 'button',
                            title: '删除该例句',
                            onclick: () => { data.examples.splice(idx, 1); renderExamples() }
                        }, '✕')
                    ))
                })
                renumberItems(list, (i) => String(rows[i]?.it.text || '').trim() !== '')
            }
            renderExamples()
            return group
        }

        function buildDerivativeGroup() {
            const selected = h('div', { class: 'chip-group' })
            const results = h('div', { class: 'picker-results' })
            const hint = h('div', { class: 'field__hint' }, '')

            const searchField = createGhostInput({
                lang,
                placeholder: currentTerms().derivativeSearchPlaceholder,
                onInput: () => scheduleSearch()
            })
            const searchInput = searchField.input

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
                    scope: 'head',      // 只检索基本形态 + 词干
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
                    selected.appendChild(h('span', { class: 'field__hint' }, termNode('derivativeEmptyHint')))
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
                    termNode('derivatives', 'optionalSuffix')
                ),
                h('div', { class: 'derivative-picker' },
                    selected,
                    fieldRow(termNode('derivativeSearchLabel'), searchField.el, {
                        extras: [h('span', { class: 'field__hint' }, termNode('derivativeSearchHint')), hint]
                    }),
                    results
                )
            )

            renderDerivatives = renderSelected
            renderSelected()
            return group
        }

        function buildExtrasGroup() {
            tagsInput = h('input', {
                class: 'input',
                placeholder: currentTerms().tagsPlaceholder,
                value: data.tags.join(', ')
            })
            const notesInput = h('textarea', {
                class: 'textarea',
                placeholder: currentTerms().notesPlaceholder,
                value: data.notes
            })
            renderExtras = () => {
                tagsInput.value = data.tags.join(', ')
                notesInput.value = data.notes || ''
            }

            return h('div', { class: 'word-form__group word-form__extras' },
                h('div', { class: 'word-form__group-title' }, termNode('others')),
                field(termNode('tags'), tagsInput, '', lang),
                field(termNode('notes'), notesInput, '', lang)
            )
        }

        /* ---------- 形态分析浮层带过来的一次性预填 ---------- */

        /**
         * 分析浮层的「存为生词」把原形与 patch 放进 store/pending-lookup.js，这里取一次（取后即清），
         * 复用外部数据源那套回填逻辑
         */
        if (!isEdit) {
            const pending = takePendingLookup()
            if (pending && pending.patch && pending.langCode === lang) {
                if (pending.lemma && !lemmaInput.value.trim()) {
                    lemmaInput.value = pending.lemma
                    lemmaField.refresh()
                }
                applyEntry({
                    pos: pending.patch.pos,
                    sourceId: 'manual',
                    patch: pending.patch
                }, [])
                refreshStemGhosts()
                refreshGenerateBtn()
                refreshLookupBtn()
            }
        }

        /* ---------- 提交 ---------- */

        /** 把表单当前内容收成一个词条对象（保存与预览共用） */
        function buildPayload() {
            const tags = tagsInput.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
            data.tags = tags
            const refValue = inflectionRef.value
            const grammarRef = (refValue && refValue !== SPECIAL_REF && refValue !== INDECL_REF)
                ? refValue
                : null

            return {
                language: lang,
                // 词条基本形态、词干一律存原文：用户可能直接敲了转写，没走失焦转换
                lemma: toScriptText(lemmaInput.value.trim()),
                pos: posSelect.value,
                // attributes 里放词性声明的字段（语法性 / 自他 / 助动词…）
                attributes: { ...data.attributes },
                inflectionType: {
                    label: inflectionLabel.value.trim(),
                    grammarRef
                },
                paradigm: normalizeParadigm(data.paradigm),
                stems: collectStems(),
                // 补充形式属于词条本身，不区分来源
                inflections: cleanList(data.inflections, ['form']).map(({ source, ...rest }) => rest),
                meanings: cleanList(data.meanings, ['text']),
                collocations: cleanList(data.collocations, ['text']),
                examples: cleanList(data.examples, ['text']).map(cleanExampleMeaning),
                derivatives: data.derivatives.map((s) => s.trim()).filter(Boolean),
                tags,
                notes: data.notes || ''
            }
        }

        /** 预览：把当前填的内容当成一张词卡打开（和列表里点开的那张卡是同一个组件） */
        function onPreview() {
            const payload = buildPayload()
            if (!payload.lemma) {
                toast.error('先填基本形态再看预览')
                lemmaInput.focus()
                return
            }
            const partLabels = {}
            for (const part of getDeriveParts(grammarDoc, payload.inflectionType.grammarRef)) {
                if (part.key !== 'base') partLabels[part.key] = part.label || part.key
            }
            openCardOverlay({ ...payload, id: data.id || 'preview' }, {
                language: lang,
                paradigmTpl: getParadigmTemplate(grammarDoc, payload.pos),
                partLabels,
                stemLabel: stemLabelOf(grammarDoc, payload.inflectionType.grammarRef, payload.pos)
            })
        }

        async function onSubmit() {
            const payload = buildPayload()
            const lemma = payload.lemma
            if (!lemma) {
                toast.error('基本形态不能为空')
                lemmaInput.focus()
                return
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
            await deleteWord(data.id)
            toast.success('已删除')
            location.hash = `#/lang/${lang}/words`
        }

        return () => {
            pageTools.destroy()
            setDualTextVisible(false)
            setBreveVisible(false)
        }
    }
}

function field(label, control, hint, lang = null) {
    return fieldRow(label, control, { hint, lang })
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

/** 例句关联的含义：空的不落库，免得导出多出一堆空壳 */
function cleanExampleMeaning(example) {
    const text = String(example.meaning?.text || '').trim()
    if (!text) {
        const copy = { ...example }
        delete copy.meaning
        return copy
    }
    return { ...example, meaning: { text, source: example.meaning.source || 'manual' } }
}

function posLabel(pos) {
    const hit = POS_LIST.find((p) => p.value === pos)
    return hit ? hit.label : pos
}

