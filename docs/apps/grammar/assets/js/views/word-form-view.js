import { h, replace } from '../utils/dom.js'
import { appStore } from '../app-state.js'
import { getLanguage } from '../data/languages.js'
import { submitWord, editWord, fetchWord, queryWords } from '../services/word-service.js'
import {
    normalizeParadigm, normalizeStem, normalizeStems, sourceLabel, posLabel
} from '../models/word.js'
import {
    loadGrammar, loadGrammarMeta, loadParadigmProfile, loadScriptProfile, getParadigmTemplate, getDeriveSpec,
    getFieldDefs, collectInflectAnchors, hiddenGenderCells, termsOf, fillTerms,
    getDeriveParts, stemLabelOf
} from '../services/grammar-service.js'
import { createParadigmTable } from '../components/paradigm-table.js'
import { openCardOverlay } from '../components/card-overlay.js'
import { createGhostInput } from '../components/ghost-input.js'
import { createSelect } from '../components/select-field.js'
import { meaningsOfSource, meaningRefLabel } from '../components/entry-lists.js'
import { fieldRow } from '../components/form-field.js'
import { bdiFragment, bdiNode, stripBdi } from '../utils/bdi.js'
import { createTabBar, createTabGroup } from '../components/tabs.js'
import { generateParadigm, previewStem } from '../models/paradigm-generate.js'
import { toast } from '../components/toast.js'
import { confirmModal, openModal } from '../components/modal.js'
import { setBreadcrumbs } from '../utils/breadcrumbs.js'
import {
    EXTERNAL_BASE, EXTERNAL_SOURCES
} from '../config/config.js'
import { posOptions } from '../utils/pos.js'
import { NO_SPACE, EDGE_SPACE, watchSpaceFields } from '../utils/space-filter.js'
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
        const grammarMeta = await loadGrammarMeta(lang)

        const externalSources = (await Promise.all(EXTERNAL_SOURCES.map(async (src) => {
            try {
                const mod = await import(new URL(`${src.file}.js`, EXTERNAL_BASE))
                if (typeof mod.lookupWordForForm !== 'function') {
                    return null
                }
                return { ...src, lookupWordForForm: mod.lookupWordForForm }
            } catch (err) {
                return null
            }
        }))).filter(Boolean)
        function currentTerms() { return termsOf(grammarDoc || grammarMeta, data.pos) }

        function termText(key, suffix = '') {
            const t = currentTerms()
            const value = key.split('.').reduce((obj, k) => (obj == null ? undefined : obj[k]), t)
            return (typeof value === 'string' ? value : '') + (suffix ? t[suffix] : '')
        }

        function termNode(key, suffix = '') {
            return h('span', { dataset: { term: key, termSuffix: suffix } }, termText(key, suffix))
        }

        function hintText(text) { return bdiFragment(text, lang) }

        function attachScriptNormalize(input) {
            if (typeof scriptProfile?.toScript !== 'function') return
            input.addEventListener('focusout', () => {
                const value = input.value
                if (!value || !value.trim()) return
                const next = String(scriptProfile.toScript(value) ?? value)
                if (next !== value) input.value = next
            })
        }

        function applyTerms() {
            const t = currentTerms()
            inflectionTypeLabelEl.textContent = t.inflectionType
            inflectionLabel.placeholder = t.inflectionTypePlaceholder
            refreshStemsText()
            const extra = form.querySelector('.js-extra-forms-title')
            if (extra) extra.textContent = t.extraForms

            for (const el of form.querySelectorAll('[data-term]')) {
                el.textContent = termText(el.dataset.term, el.dataset.termSuffix)
            }
            renderMeanings()
            renderInflections()
            renderCollocations()
            renderExamples()
            renderDerivatives()
            renderExtras()
        }
        const paradigmProfile = await loadParadigmProfile(lang, grammarMeta)
        const scriptProfile = await loadScriptProfile(lang, grammarMeta)
        const hasScript = typeof scriptProfile?.toScript === 'function'

        const data = isEdit ? await loadForEdit(editId) : emptyData()
        if (isEdit && !data) {
            replace(main, h('div', { class: 'empty' },
                h('div', { class: 'empty__title' }, '生词不存在'),
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

        const head = h('div', { class: 'page-head page-head--display' },
            h('div', {},
                h('h1', { class: 'page-head__title' },
                    bdiNode(language.native, lang),
                    ' · ', language.name
                ),
                h('div', { class: 'page-head__sub' }, isEdit ? '编辑生词' : '添加生词')
            )
        )

        const form = h('form', {
            class: 'word-form',
            onsubmit: (e) => { e.preventDefault(); onSubmit() }
        })
        watchSpaceFields(form)

        let renderMeanings = () => {}
        let renderInflections = () => {}
        let renderExamples = () => {}
        let renderCollocations = () => {}
        let renderDerivatives = () => {}
        let renderExtras = () => {}
        let setMeaningSource = () => {}
        let tagsInput = null
        let meaningSource = 'manual'
        let collocationSource = 'manual'
        let exampleSource = 'manual'

        function sourceIds(items = []) {
            const ids = ['manual', ...externalSources.map((src) => src.id)]
            for (const it of items) {
                const id = it.source || 'manual'
                if (!ids.includes(id)) ids.push(id)
            }
            return ids
        }

        function sourceTabBar({ items, active, onPick }) {
            return createTabBar({
                items: sourceIds(items).map((id) => ({ key: id, label: sourceLabel(id) })),
                active,
                lang,
                onChange: onPick
            }).el
        }

        function firstSourceWithContent(items) {
            const hit = sourceIds(items).find((id) => items.some((it) => (it.source || 'manual') === id && Object.values(it).some((v) => typeof v === 'string' && v.trim())))
            return hit || 'manual'
        }

        function indexCell() {
            return h('span', { class: 'word-form__index' })
        }

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
            spaceKey: hasScript,
            lang,
            dataset: { space: NO_SPACE },
            placeholder: currentTerms().lemma.placeholder,
            disabled: isEdit,
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


        let paradigmTab = null
        let autoInflectionLabel = ''
        let applyingLookup = false

        const lookupStatus = h('span', { class: 'field__hint lookup__status' }, '')

        const lookupBtn = h('button', {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () => onLookupAll()
        }, '从来源查询')

        function refreshLookupBtn() {
            const has = Boolean(lemmaInput.value.trim()) && externalSources.length > 0
            lookupBtn.disabled = !has
            lookupBtn.title = has
                ? '从外部来源查询'
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

        const inflectionRef = createSelect({
            lang,
            className: 'select',
            nowrap: true,
            onChange: (v) => {
                const opt = currentOptionsById[v]
                if (v === SPECIAL_REF) inflectionLabel.value = ''
                else if (v === INDECL_REF) inflectionLabel.value = stripBdi(currentTerms().indeclinable)
                else if (opt) inflectionLabel.value = stripBdi(opt.short || opt.label)
                autoInflectionLabel = inflectionLabel.value
                renderExtraParts()
                refreshStemGhosts()
                renderParadigmBlock()
                refreshGenerateBtn()
            }
        })

        function rebuildRefOptions(initialValue) {
            const pos = posSelect.value
            const opts = collectInflectAnchors(grammarDoc, lang, pos)
            currentOptionsById = Object.fromEntries(opts.map((o) => [o.id, o]))

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
            dataset: { space: EDGE_SPACE },
            placeholder: currentTerms().inflectionTypePlaceholder
        })
        const inflectionLabel = inflectionField.input

        const principalField = createGhostInput({
            value: data.stems.base || '',
            spaceKey: hasScript,
            lang,
            dataset: { space: NO_SPACE },
            placeholder: currentTerms().stems.placeholder,
            getGhost: () => derivedBase(),
            onInput: () => { refreshStemGhosts(); refreshGenerateBtn() }
        })
        const principalInput = principalField.input
        attachScriptNormalize(principalInput)

        const extraPartsSlot = h('div', { class: 'field__parts' })
        let extraGhosts = []

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

        const generateHint = h('span', { class: 'field__hint word-form__title-hint' })
        const generateBtn = h('button', {
            class: 'btn btn--sm',
            type: 'button',
            onclick: onGenerate
        }, '生成表格')
        const generateBar = h('div', { class: 'word-form__title-actions' }, generateHint, generateBtn)


        const genderSlot = h('div', {})

        function renderGenderField() {
            genderSlot.replaceChildren()
            const defs = getFieldDefs(grammarDoc, posSelect.value)
            genderSlot.hidden = defs.length === 0
            if (!defs.length) return

            for (const def of defs) {
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
                            const ordered = def.options.map((o) => o.value).filter((v) => values.includes(v))
                            values.length = 0
                            values.push(...ordered)
                            data.attributes[def.key] = [...ordered]
                            paint()
                            renderParadigmBlock()
                        }
                    }, bdiFragment(opt.label, lang))
                }))
            }

            paint()
            if (values.length) data.attributes[def.key] = [...values]
            return group
        }

        const lookupBar = h('div', { class: 'word-form__title-actions' }, lookupStatus, lookupBtn)
        form.appendChild(h('div', {},
            h('div', { class: 'word-form__group-title' },
                termNode('basicTitle'),
                externalSources.length ? lookupBar : null
            ),
            h('div', { class: 'word-form__row word-form__card' },
                fieldRow(termNode('lemma.label'), lemmaField.el),
                fieldRow(termNode('posLabel'), posSelect, { target: posSelect })
            )
        ))

        const inflectionTypeLabelEl = h('span', { class: 'field__label' }, currentTerms().inflectionType)
        const inflectionRow = h('div', { class: 'word-form__panel' },
            genderSlot,
            fieldRow(termNode('anchorLabel'), inflectionRef),
            fieldRow(inflectionTypeLabelEl, inflectionField.el)
        )

        const stemsLabelEl = h('span', { class: 'field__label' }, currentTerms().stems.label)
        const stemsHintEl = h('span', { class: 'field__hint' }, hintText(currentTerms().stems.hint))
        const stemsRow = fieldRow(stemsLabelEl, principalField.el, {
            extras: [stemsHintEl],
            target: principalInput
        })

        const stemsBlock = h('div', { class: 'word-form__stems' },
            h('div', { class: 'word-form__group-title' }, termNode('stemsTitle')),
            stemsRow,
            extraPartsSlot
        )

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

        const previewBtn = h('button', {
            class: 'btn',
            type: 'button',
            onclick: onPreview
        }, '预览')
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


        const toRoman = typeof scriptProfile?.toRoman === 'function'
            ? (text) => scriptProfile.toRoman(text)
            : null
        const scriptRange = toRoman && scriptProfile?.scriptRange instanceof RegExp
            ? scriptProfile.scriptRange
            : null

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


        function currentDeriveSpec() {
            const ref = inflectionRef.value
            if (!ref || ref === INDECL_REF) return null
            if (ref === SPECIAL_REF) return getDeriveSpec(grammarDoc, `${lang}-${posSelect.value}`)
            return getDeriveSpec(grammarDoc, ref) || getDeriveSpec(grammarDoc, `${lang}-${posSelect.value}`)
        }

        function currentBasePart() {
            const spec = currentDeriveSpec()
            if (!spec || !Array.isArray(spec.parts)) return null
            return spec.parts.find((part) => part && part.key === 'base') || null
        }

        function refreshStemsText() {
            const t = currentTerms()
            const base = currentBasePart()
            lemmaInput.placeholder = t.lemma.placeholder
            stemsLabelEl.textContent = base?.label || t.stems.label
            stemsHintEl.replaceChildren(hintText(base?.hint || t.stems.hint))
            principalInput.placeholder = base?.placeholder || t.stems.placeholder
        }

        function currentParts() {
            const spec = currentDeriveSpec()
            if (!spec || !Array.isArray(spec.parts)) return []
            return spec.parts.filter((part) => part && part.key && part.key !== 'base')
        }

        function renderExtraParts() {
            extraGhosts = []
            refreshStemsText()
            const parts = currentParts()
            const allowed = new Set(['base', ...parts.map((p) => p.key)])
            for (const key of Object.keys(data.stems)) {
                if (!allowed.has(key)) delete data.stems[key]
            }

            extraPartsSlot.replaceChildren()
            if (!parts.length) {
                refreshStemGhosts()
                return
            }

            for (const part of parts) {
                const setValue = (raw) => {
                    const value = String(raw ?? '').trim()
                    if (value) data.stems[part.key] = value
                    else delete data.stems[part.key]
                    refreshStemGhosts()
                    refreshGenerateBtn()
                    if (part.kind === 'select'
                        && currentParts().some((p) => p.showWhen && p.showWhen[part.key] !== undefined)) {
                        renderExtraParts()
                    }
                }
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
                        spaceKey: hasScript,
                        lang,
                        dataset: { partKey: part.key, space: NO_SPACE },
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
                    lang,
                    extras: [part.hint ? h('span', { class: 'field__hint' }, hintText(part.hint)) : null]
                })
                partField.hidden = !visible
                extraPartsSlot.appendChild(partField)
            }
            refreshStemGhosts()
        }

        function toScriptText(value) {
            if (!value || typeof scriptProfile?.toScript !== 'function') return value
            return String(scriptProfile.toScript(value) ?? value)
        }

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

        function derivedBase() {
            const spec = currentDeriveSpec()
            if (!spec) return ''
            const stems = collectStems()
            delete stems.base
            const headword = normalizeStem(lemmaInput.value)
            return toScriptText(previewStem('', 'base', spec, { ...romanStems(stems), headword }, paradigmProfile, scriptProfile))
        }

        function derivedPart(key) {
            const spec = currentDeriveSpec()
            if (!spec) return ''
            const stems = collectStems()
            delete stems[key]
            const headword = normalizeStem(lemmaInput.value)
            const roman = romanStems(stems)
            return toScriptText(previewStem(roman.base || '', key, spec, { ...roman, headword }, paradigmProfile, scriptProfile))
        }

        function refreshStemGhosts() {
            principalField.refresh()
            for (const item of extraGhosts) item.refresh()
            annotateForm()
            annotateBreves(form, { selector: '.ghost-input__hint' })
        }

        function collectStems() {
            const stems = {}
            const base = normalizeStem(principalInput.value)
            if (base) stems.base = base
            for (const [key, value] of Object.entries(data.stems)) {
                if (key !== 'base' && value) stems[key] = normalizeStem(value)
            }
            return stems
        }

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
            if (!canGenerate) generateBtn.title = '该变格、变位类型还没有自动生成规则'
            else if (!hasStem) generateBtn.title = '请先填写：词干'
            else if (missing.length) generateBtn.title = `请先填写：${missing.join('、')}`
            else generateBtn.title = '按词干和词尾规则自动填表（会覆盖已填内容）'
            generateHint.textContent = generateBtn.disabled ? generateBtn.title : ''
            return missing
        }

        function onGenerate() {
            const spec = currentDeriveSpec()
            if (!spec || !spec.endings || !Object.keys(spec.endings).length) return

            const stem = normalizeStem(principalInput.value) || derivedBase()
            if (!stem) {
                toast.error(stemsBlock.hidden ? '请先填写：基本形态' : '请先填写：词干')
                if (!stemsBlock.hidden) principalInput.focus()
                else lemmaInput.focus()
                return
            }
            const missing = missingRequiredParts(spec)
            if (missing.length) {
                toast.error(`请先填写：${missing.join('、')}`, 5000)
                return
            }

            {
                const headword = normalizeStem(lemmaInput.value)
                const filledParts = []
                const currentStems = collectStems()
                for (const part of currentParts()) {
                    if (String(data.stems[part.key] ?? '').trim()) continue
                    const roman = romanStems(currentStems)
                    const value = previewStem(roman.base || '', part.key, spec,
                        { ...roman, headword }, paradigmProfile, scriptProfile)
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
                toast.error('判不出元音模式，请检查元音点', 6000)
                return
            }

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
                toast.info(`已生成 ${filled.length} 格；未生成：${detail}`, 8000)
            } else {
                toast.success(`已生成 ${filled.length} 格（已覆盖原有内容），请确认无误后保存`, 5000)
            }
        }


        function renderParadigmBlock() {
            paradigmSlot.replaceChildren()
            if (grammarDoc?.paradigm === false) return
            if (inflectionRef.value === INDECL_REF) {
                paradigmSlot.hidden = true
                return
            }
            paradigmSlot.hidden = false
            const tpl = getParadigmTemplate(grammarDoc, data.pos)
            if (!tpl) return

            const spec = currentDeriveSpec()
            const skip = Array.isArray(spec?.skipTables) ? spec.skipTables : []

            const titleRow = h('div', { class: 'word-form__group-title' },
                h('span', {}, fillTerms(currentTerms().paradigmTitle, posLabel(data.pos))),
                generateBar
            )

            const ref = inflectionRef.value
            const anchored = (tpl.tables || []).some((t) => Array.isArray(t?.anchors))
            const noAnchor = !ref || ref === SPECIAL_REF || ref === INDECL_REF
            let tables = (tpl.tables || []).filter((t) => {
                if (skip.includes(t.key)) return false
                if (!anchored) return true
                if (!noAnchor && Array.isArray(t.anchors)) return t.anchors.includes(ref)
                return t.default === true
            })
            if (!tables.length && anchored) {
                tables = (tpl.tables || []).filter((t) => t.default === true && !skip.includes(t.key))
            }
            if (!tables.length && stemsBlock.hidden) {
                paradigmSlot.hidden = true
                return
            }

            const singleTable = tables.length <= 1

            const wrap = h('div', { class: 'word-form__group' }, stemsBlock,
                tables.length ? titleRow : null)

            const panels = []
            const hiddenGender = hiddenGenderCells(tpl, data.pos, data)
            for (const tableTpl of tables) {
                const tableData = data.paradigm[tableTpl.key] || {}
                const tbl = createParadigmTable(tableTpl, tableData, {
                    lang,
                    mode: 'edit',
                    showTitle: false,
                    hideColumns: hiddenGender.columns,
                    hideRows: hiddenGender.rows,
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

            paradigmSlot.appendChild(wrap)
        }


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
                data.attributes[key] = def.multi ? list : list[0]
            }
            renderGenderField()

            applyInflectionType(entry.patch.inflectionType)

            if (!stemsBlock.hidden) applyStems(entry.patch.stems)

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
            renderParadigmBlock()
        }

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

        function applyInflectionType(inflectionType) {
            const ref = inflectionType?.grammarRef
            if (!ref || !currentOptionsById[ref]) {
                if (autoInflectionLabel && inflectionLabel.value.trim() === autoInflectionLabel) {
                    inflectionLabel.value = ''
                }
                autoInflectionLabel = ''
                return
            }

            rebuildRefOptions(ref)
            const current = inflectionLabel.value.trim()
            if (!current || current === autoInflectionLabel) {
                autoInflectionLabel = stripBdi(inflectionType.label || currentOptionsById[ref].short || '')
                inflectionLabel.value = autoInflectionLabel
            }
            renderExtraParts()
        }

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
                    h('span', { class: 'lookup-choice__label' }, bdiFragment(entry.label, lang))
                    )
                    return btn
                })

                openModal({
                    title: '选择查询结果',
                    body: h('div', {},
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
                    lookupStatus.textContent = '所有来源都没有找到这个词'
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
                toast.success(h('span', {}, `已从 ${picked.sourceLabel} 获取「`, bdiNode(lemma, lang), '」'))
            } catch (err) {
                lookupStatus.textContent = `查询失败：${err.message}`
                lookupStatus.style.color = 'var(--c-danger)'
                toast.error(`查询失败：${err.message}`)
            } finally {
                lookupBtn.disabled = false
            }
        }


        function buildMeaningGroup() {
            const tabs = h('div', { class: 'word-form__tabs' })
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

            function meaningSources() {
                const ids = ['manual', ...externalSources.map((s) => s.id)]
                for (const m of data.meanings) {
                    const src = m.source || 'manual'
                    if (!ids.includes(src)) ids.push(src)
                }
                return ids
            }

            function renderTabs() {
                tabs.replaceChildren(createTabBar({
                    items: meaningSources().map((id) => ({ key: id, label: sourceLabel(id) })),
                    active: meaningSource,
                    lang,
                    onChange: (id) => {
                        meaningSource = id
                        renderMeanings()
                        renderExamples()
                    }
                }).el)
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
                            dataset: { space: EDGE_SPACE },
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
                            dataset: { space: EDGE_SPACE },
                            oninput: (e) => { it.group = e.target.value }
                        }),
                        h('input', {
                            class: 'input', placeholder: currentTerms().inflectionLabelPlaceholder, value: it.label,
                            dataset: { space: EDGE_SPACE },
                            oninput: (e) => { it.label = e.target.value }
                        }),
                        ((f) => { attachScriptNormalize(f.input); return f.el })(createGhostInput({
                            value: it.form,
                            spaceKey: hasScript,
                            lang,
                            dataset: { space: EDGE_SPACE },
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
                            spaceKey: hasScript,
                            lang,
                            dataset: { space: EDGE_SPACE },
                            placeholder: currentTerms().collocationTextPlaceholder,
                            onInput: (e) => {
                                it.text = e.target.value
                                renumberItems(list, (i) => String(rows[i]?.it.text || '').trim() !== '')
                            }
                        })),
                        h('input', {
                            class: 'input', placeholder: currentTerms().collocationGlossPlaceholder, value: it.gloss,
                            dataset: { space: EDGE_SPACE },
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


        function meaningOptions() {
            const sources = []
            for (const m of data.meanings) {
                const id = m.source || 'manual'
                if (!sources.includes(id)) sources.push(id)
            }
            const options = [{ value: '', label: '不关联含义' }]
            for (const id of sources) {
                let order = 0
                for (const m of meaningsOfSource(data.meanings, id)) {
                    const text = String(m.text || '').trim()
                    if (!text) continue
                    order += 1
                    const ref = { source: id, text }
                    options.push({
                        value: exampleMeaningValue(ref),
                        label: `${order}. ${text}`,
                        display: meaningRefLabel(ref, data.meanings, meaningSource),
                        group: sourceLabel(id)
                    })
                }
            }
            return options
        }

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
                            spaceKey: hasScript,
                            lang,
                            dataset: { space: EDGE_SPACE },
                            placeholder: currentTerms().exampleTextPlaceholder,
                            onInput: (e) => {
                                it.text = e.target.value
                                renumberItems(list, (i) => String(rows[i]?.it.text || '').trim() !== '')
                            }
                        })),
                        h('input', {
                            class: 'input', placeholder: currentTerms().exampleCitationPlaceholder, value: it.citation,
                            dataset: { space: EDGE_SPACE },
                            oninput: (e) => { it.citation = e.target.value }
                        }),
                        h('input', {
                            class: 'input word-form__cell--translation', placeholder: currentTerms().exampleTranslationPlaceholder, value: it.translation,
                            dataset: { space: EDGE_SPACE },
                            oninput: (e) => { it.translation = e.target.value }
                        }),
                        createSelect({
                            lang,
                            className: 'select word-form__cell--meaning',
                            value: exampleMeaningValue(it.meaning),
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
                dataset: { space: EDGE_SPACE },
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
                    scope: 'head',
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
                    h('span', { class: 'picker-item__lemma' }, bdiNode(w.lemma, lang)),
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
                        bdiNode(lemma, lang),
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
                        extras: [hint]
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
                dataset: { space: EDGE_SPACE },
                value: data.tags.join(', ')
            })
            const notesInput = h('textarea', {
                class: 'textarea',
                placeholder: currentTerms().notesPlaceholder,
                dataset: { space: EDGE_SPACE },
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


        function buildPayload() {
            const tags = tagsInput.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
            data.tags = tags
            const refValue = inflectionRef.value
            const grammarRef = (refValue && refValue !== SPECIAL_REF && refValue !== INDECL_REF)
                ? refValue
                : null

            return {
                language: lang,
                lemma: toScriptText(lemmaInput.value.trim()),
                pos: posSelect.value,
                attributes: { ...data.attributes },
                inflectionType: {
                    label: inflectionLabel.value.trim(),
                    grammarRef
                },
                paradigm: normalizeParadigm(data.paradigm),
                stems: collectStems(),
                inflections: cleanList(data.inflections, ['form']).map(({ source, ...rest }) => rest),
                meanings: cleanList(data.meanings, ['text']),
                collocations: cleanList(data.collocations, ['text']),
                examples: cleanList(data.examples, ['text']).map(cleanExampleMeaning),
                derivatives: data.derivatives.map((s) => s.trim()).filter(Boolean),
                tags,
                notes: data.notes || ''
            }
        }

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
                    else toast.success(h('span', {}, '「', bdiNode(lemma, lang), '」已存在，记录次数 +1'))
                }
                location.hash = `#/lang/${lang}/words`
            } catch (err) {
                if (String(err.name) === 'ConstraintError') {
                    toast.error('已有同一语言、同一基本形态与该词性的生词', 5000)
                } else {
                    toast.error(`保存失败：${err.message}`, 5000)
                }
            }
        }

        async function onDelete() {
            const ok = await confirmModal({
                title: '删除生词',
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

function cleanExampleMeaning(example) {
    const text = String(example.meaning?.text || '').trim()
    if (!text) {
        const copy = { ...example }
        delete copy.meaning
        return copy
    }
    return { ...example, meaning: { text, source: example.meaning.source || 'manual' } }
}
