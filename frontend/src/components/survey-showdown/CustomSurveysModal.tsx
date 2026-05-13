'use client'

import { useState, type DragEvent } from 'react'
import {
  MAX_CUSTOM_SURVEYS,
  MAX_CUSTOM_COLLECTIONS,
  CUSTOM_SURVEY_NAME_MAX_LENGTH,
  CUSTOM_COLLECTION_NAME_MAX_LENGTH,
  CUSTOM_SURVEY_QUESTION_MAX_LENGTH,
  CUSTOM_SURVEY_ANSWER_MAX_LENGTH,
} from '@/lib/constants'
import type { Answer, CustomSurvey, CustomCollection } from '@/lib/constants'
import { customSurveyAnswerId } from '@/lib/api/survey-showdown/judge'

const SURVEY_DRAG_MIME = 'application/x-good-night-survey-id'

/** Modal-local draft: points may be empty while typing; blur normalizes to 1–100 (empty → 10). */
interface DraftAnswer extends Omit<Answer, 'points'> {
  points: number | ''
}

type SurveyDraft = { id: string; question: string; answers: DraftAnswer[] }

const emptySurveyDraft = (): SurveyDraft => ({
  id: `q-${Date.now()}-${Math.random()}`,
  question: '',
  answers: [
    { id: '', answer: '', points: 30 },
    { id: '', answer: '', points: 20 },
  ],
})
const emptyAnswer = (): DraftAnswer => ({ id: '', answer: '', points: 10 })

const clampSurveyPoints = (n: number) => Math.max(1, Math.min(100, Math.round(n)))

/** Empty draft → 10 (matches emptyAnswer default); otherwise clamp 1–100. */
const normalizePointsOnBlur = (points: number | '') =>
  points === '' ? 10 : clampSurveyPoints(Number.isFinite(points) ? points : 10)

interface CustomSurveysModalProps {
  surveys: CustomSurvey[]
  collections: CustomCollection[]
  onSaveSurvey: (survey: CustomSurvey) => void
  onDeleteSurvey: (id: string) => void
  onMoveSurveyToCollection: (surveyId: string, targetCollectionId: string | null) => void
  onSaveCollection: (collection: CustomCollection) => void
  onDeleteCollection: (id: string) => void
  onClose: () => void
}

export default function CustomSurveysModal({
  surveys, collections, onSaveSurvey, onDeleteSurvey, onMoveSurveyToCollection,
  onSaveCollection, onDeleteCollection, onClose,
}: CustomSurveysModalProps) {
  const [view, setView] = useState<'list' | 'survey' | 'collection'>('list')
  const [editingSurvey, setEditingSurvey] = useState<CustomSurvey | null>(null)
  const [editingCollection, setEditingCollection] = useState<CustomCollection | null>(null)
  const [sName, setSName] = useState('')
  const [sCollId, setSCollId] = useState<string | null>(null)
  const [sDraft, setSDraft] = useState<SurveyDraft>(emptySurveyDraft())
  const [cName, setCName] = useState('')
  const [cError, setCError] = useState('')
  const [sError, setSError] = useState('')

  function openCreateSurvey() { setEditingSurvey(null); setSName(''); setSCollId(null); setSDraft(emptySurveyDraft()); setSError(''); setView('survey') }
  function openEditSurvey(s: CustomSurvey) {
    setEditingSurvey(s); setSName(s.name ?? ''); setSCollId(s.collectionId)
    setSDraft({
      id: s.id,
      question: s.question,
      answers: s.answers.map((a) => ({
        id: a.id?.trim() || customSurveyAnswerId(s.question, a.answer),
        answer: a.answer,
        points: a.points,
      })),
    })
    setSError(''); setView('survey')
  }
  function openCreateCollection() { setEditingCollection(null); setCName(''); setCError(''); setView('collection') }
  function openEditCollection(c: CustomCollection) { setEditingCollection(c); setCName(c.name); setCError(''); setView('collection') }

  function goToList() {
    setEditingSurvey(null)
    setEditingCollection(null)
    setView('list')
  }

  function saveSurvey() {
    const surveyNameTrimmed = sName.trim()
    const name: string | null = surveyNameTrimmed ? surveyNameTrimmed : null
    if (surveyNameTrimmed.length > CUSTOM_SURVEY_NAME_MAX_LENGTH) {
      setSError(`Title must be ${CUSTOM_SURVEY_NAME_MAX_LENGTH} characters or less.`)
      return
    }
    const q = sDraft
    const qText = q.question.trim()
    const answers = q.answers.filter((a) => a.answer.trim())
    if (!qText) { setSError('Question is required.'); return }
    if (answers.length < 2) { setSError('At least 2 answers are required.'); return }
    if (qText.length > CUSTOM_SURVEY_QUESTION_MAX_LENGTH) {
      setSError(`Question must be ${CUSTOM_SURVEY_QUESTION_MAX_LENGTH} characters or less.`)
      return
    }
    for (const [answerIndex, a] of answers.entries()) {
      if (a.answer.trim().length > CUSTOM_SURVEY_ANSWER_MAX_LENGTH) {
        setSError(`Answer ${answerIndex + 1} must be ${CUSTOM_SURVEY_ANSWER_MAX_LENGTH} characters or less.`)
        return
      }
    }
    if (answers.some((a) => a.points === '')) {
      setSError('Enter points for every answer.')
      return
    }
    const survey: CustomSurvey = {
      id: editingSurvey?.id || `s-${Date.now()}`,
      name,
      collectionId: sCollId || null,
      question: qText,
      answers: answers.map((a) => ({
        id: customSurveyAnswerId(qText, a.answer.trim()),
        answer: a.answer.trim(),
        points: a.points as number,
      })),
    }
    onSaveSurvey(survey); goToList()
  }

  function saveCollection() {
    const collectionName = cName.trim()
    if (!collectionName) { setCError('Collection name is required.'); return }
    if (collectionName.length > CUSTOM_COLLECTION_NAME_MAX_LENGTH) {
      setCError(`Collection name must be ${CUSTOM_COLLECTION_NAME_MAX_LENGTH} characters or less.`)
      return
    }
    if (!editingCollection && collections.length >= MAX_CUSTOM_COLLECTIONS) {
      setCError(`You can have at most ${MAX_CUSTOM_COLLECTIONS} collections.`)
      return
    }
    const coll: CustomCollection = { id: editingCollection?.id || `c-${Date.now()}`, name: collectionName }
    onSaveCollection(coll); goToList()
  }

  function updateQuestionLine(val: string) {
    setSDraft((f) => ({ ...f, question: val }))
  }
  function updateAnswer(ai: number, field: 'answer' | 'points', val: string | number | '') {
    setSDraft((f) => ({
      ...f,
      answers: f.answers.map((a, j) =>
        j === ai
          ? field === 'answer'
            ? { ...a, answer: val as string }
            : { ...a, points: val as number | '' }
          : a,
      ),
    }))
  }
  function addAnswer() {
    setSDraft((f) => (f.answers.length < 8 ? { ...f, answers: [...f.answers, emptyAnswer()] } : f))
  }
  function removeAnswer(ai: number) {
    setSDraft((f) => ({ ...f, answers: f.answers.filter((_, j) => j !== ai) }))
  }

  const atLimit = surveys.length >= MAX_CUSTOM_SURVEYS
  const atCollectionLimit = collections.length >= MAX_CUSTOM_COLLECTIONS

  function assignSurveyToCollection(surveyId: string, targetCollectionId: string | null) {
    const s = surveys.find((x) => x.id === surveyId)
    if (!s) return
    const from = s.collectionId ?? null
    const to = targetCollectionId ?? null
    if (from === to) return
    onMoveSurveyToCollection(surveyId, targetCollectionId)
  }

  const dropHandlersForZone = (targetCollectionId: string | null) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const id = e.dataTransfer.getData(SURVEY_DRAG_MIME) || e.dataTransfer.getData('text/plain')
      if (!id) return
      assignSurveyToCollection(id, targetCollectionId)
    },
  })

  const uncategorizedSurveys = surveys.filter((s) => !s.collectionId)
  const showUncategorizedSection = collections.length > 0 || uncategorizedSurveys.length > 0
  const uncatDrop = dropHandlersForZone(null)

  const fieldStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-body)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', outline: 'none' }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }
  const fieldHintStyle: React.CSSProperties = { marginTop: 5, fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-faint)' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '24px', width: 'min(560px,96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* List View */}
        {view === 'list' && (<>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)' }}>✏ My Surveys</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={openCreateCollection} disabled={atCollectionLimit} style={{ padding: '7px 12px', borderRadius: 9, fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '0.06em', background: atCollectionLimit ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)', color: atCollectionLimit ? 'var(--text-faint)' : 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', cursor: atCollectionLimit ? 'default' : 'pointer' }}>+ Collection</button>
              <button onClick={openCreateSurvey} disabled={atLimit} style={{ padding: '7px 12px', borderRadius: 9, fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '0.06em', background: atLimit ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg,#F0A500,#C07A00)', color: atLimit ? 'var(--text-faint)' : '#fff', border: 'none', cursor: atLimit ? 'default' : 'pointer' }}>+ New Survey</button>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
            {surveys.length === 0 && collections.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)', fontFamily: 'var(--font-body)', fontSize: 13 }}>No custom surveys yet.<br />Create one to get started!</div>
            )}
            {collections.map(c => {
              const collSurveys = surveys.filter(s => s.collectionId === c.id)
              const zoneDrop = dropHandlersForZone(c.id)
              return (
                <div key={c.id} style={{ marginBottom: 14 }} {...zoneDrop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', flex: 1 }}>{c.name}</div>
                    <button type="button" onClick={() => openEditCollection(c)} aria-label="Edit collection" title="Edit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, borderRadius: 6, background: 'transparent', color: 'var(--text-faint)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}><PencilIcon /></button>
                    <button type="button" onClick={() => onDeleteCollection(c.id)} aria-label="Delete collection" title="Delete" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, borderRadius: 6, background: 'transparent', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', cursor: 'pointer' }}><TrashIcon /></button>
                  </div>
                  {collSurveys.map(s => (
                    <SurveyRow
                      key={s.id}
                      survey={s}
                      dropTargetCollectionId={c.id}
                      onEdit={() => openEditSurvey(s)}
                      onDelete={() => onDeleteSurvey(s.id)}
                      onSurveyDrop={assignSurveyToCollection}
                    />
                  ))}
                  {collSurveys.length === 0 && (
                    <div
                      style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-body)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.08)', minHeight: 40, display: 'flex', alignItems: 'center' }}
                    >
                      No surveys in this collection — drop a survey here to add it.
                    </div>
                  )}
                </div>
              )
            })}
            {showUncategorizedSection && (
              <div style={{ marginBottom: 14 }} {...uncatDrop}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>📋 Uncategorized</div>
                {uncategorizedSurveys.map(s => (
                  <SurveyRow
                    key={s.id}
                    survey={s}
                    dropTargetCollectionId={null}
                    onEdit={() => openEditSurvey(s)}
                    onDelete={() => onDeleteSurvey(s.id)}
                    onSurveyDrop={assignSurveyToCollection}
                  />
                ))}
                {collections.length > 0 && uncategorizedSurveys.length === 0 && (
                  <div
                    style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-body)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.08)', minHeight: 40, display: 'flex', alignItems: 'center' }}
                  >
                    Drop a survey here to remove it from a collection.
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, flexShrink: 0, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
            <div>{surveys.length} of {MAX_CUSTOM_SURVEYS} surveys used</div>
            <div style={{ marginTop: 4 }}>{collections.length} of {MAX_CUSTOM_COLLECTIONS} collections used</div>
          </div>
        </>)}

        {/* Survey Form */}
        {view === 'survey' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0 }}>
            <button onClick={goToList} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)', flex: 1 }}>{editingSurvey ? 'Edit Survey' : 'New Survey'}</div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Title <span style={{ fontSize: 9, color: 'var(--text-faint)', fontWeight: 400 }}>— optional</span></label>
                <input value={sName} onChange={e => setSName(e.target.value)} placeholder="e.g. Office Party Night" style={fieldStyle} maxLength={CUSTOM_SURVEY_NAME_MAX_LENGTH} />
              </div>
              <div>
                <label style={labelStyle}>Collection <span style={{ fontSize: 9, color: 'var(--text-faint)', fontWeight: 400 }}>— optional</span></label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <select
                    value={sCollId || ''}
                    onChange={e => setSCollId(e.target.value || null)}
                    style={{ ...fieldStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
                  >
                    <option value="" style={{ background: '#0d1224', color: 'var(--text-muted)' }}>None</option>
                    {collections.map(c => <option key={c.id} value={c.id} style={{ background: '#0d1224', color: 'var(--text)' }}>{c.name}</option>)}
                  </select>
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 10,
                      color: 'var(--text-faint)',
                      pointerEvents: 'none',
                      lineHeight: 1,
                    }}
                  >
                    ▼
                  </span>
                </div>
              </div>
              <div key={sDraft.id} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px' }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Question</label>
                <input value={sDraft.question} onChange={e => updateQuestionLine(e.target.value)} placeholder="e.g. Name something you would pack for a road trip" style={{ ...fieldStyle, marginBottom: 8 }} maxLength={CUSTOM_SURVEY_QUESTION_MAX_LENGTH} />
                <span style={{ ...labelStyle, marginBottom: 8 }}>Answers</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sDraft.answers.map((a, ai) => (
                    <div key={ai} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={a.answer} onChange={e => updateAnswer(ai, 'answer', e.target.value)} placeholder={`Answer ${ai + 1}`} style={{ ...fieldStyle, flex: 1 }} maxLength={CUSTOM_SURVEY_ANSWER_MAX_LENGTH} />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={a.points === '' ? '' : String(a.points)}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '') updateAnswer(ai, 'points', '')
                          else {
                            const n = Number.parseInt(v, 10)
                            if (Number.isFinite(n)) updateAnswer(ai, 'points', n)
                          }
                        }}
                        onBlur={() => updateAnswer(ai, 'points', normalizePointsOnBlur(a.points))}
                        aria-label={`Points for answer ${ai + 1}`}
                        style={{ ...fieldStyle, width: 64, textAlign: 'center', padding: '9px 6px' }}
                      />
                      {sDraft.answers.length > 2 && <button onClick={() => removeAnswer(ai)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,77,106,0.08)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>}
                    </div>
                  ))}
                </div>
                {sDraft.answers.length < 8 && <button onClick={addAnswer} type="button" style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-body)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>+ Add answer</button>}
              </div>
            </div>
          </div>
          {sError && <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.25)', fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A', flexShrink: 0 }}>{sError}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexShrink: 0 }}>
            <button onClick={goToList} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.06em', border: '1px solid rgba(255,255,255,0.08)' }}>CANCEL</button>
            <button onClick={saveSurvey} style={{ flex: 2, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(240,165,0,0.3)' }}>SAVE SURVEY</button>
          </div>
        </>)}

        {/* Collection Form */}
        {view === 'collection' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={goToList} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)', flex: 1 }}>{editingCollection ? 'Edit Collection' : 'New Collection'}</div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Collection Name</label>
            <input value={cName} onChange={e => setCName(e.target.value)} placeholder="e.g. Family Night" style={fieldStyle} autoFocus maxLength={CUSTOM_COLLECTION_NAME_MAX_LENGTH} />
            <div style={fieldHintStyle}>{cName.trim().length}/{CUSTOM_COLLECTION_NAME_MAX_LENGTH} characters</div>
          </div>
          {cError && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.25)', fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A' }}>{cError}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={goToList} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.06em', border: '1px solid rgba(255,255,255,0.08)' }}>CANCEL</button>
            <button onClick={saveCollection} style={{ flex: 2, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#4D7EFF,#2952CC)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(77,126,255,0.3)' }}>SAVE COLLECTION</button>
          </div>
        </>)}
      </div>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
        fill="currentColor"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
        fill="currentColor"
      />
    </svg>
  )
}

function SurveyDragHandle({ surveyId }: { surveyId: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(SURVEY_DRAG_MIME, surveyId)
        e.dataTransfer.setData('text/plain', surveyId)
        e.dataTransfer.effectAllowed = 'move'
      }}
      aria-label="Drag to move survey to another collection or uncategorized"
      title="Drag to move survey"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 2px',
        cursor: 'grab',
        color: 'var(--text-faint)',
        borderRadius: 6,
        touchAction: 'none',
      }}
    >
      <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="1.5" y1="2.5" x2="12.5" y2="2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="1.5" y1="7.5" x2="12.5" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function SurveyRow({
  survey,
  dropTargetCollectionId,
  onEdit,
  onDelete,
  onSurveyDrop,
}: {
  survey: CustomSurvey
  dropTargetCollectionId: string | null
  onEdit: () => void
  onDelete: () => void
  onSurveyDrop: (surveyId: string, targetCollectionId: string | null) => void
}) {
  const q = survey.question.trim()
  const nameTrim = survey.name?.trim() ?? ''
  const display = nameTrim ? nameTrim : (q || 'No question line yet')
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const id = e.dataTransfer.getData(SURVEY_DRAG_MIME) || e.dataTransfer.getData('text/plain')
        if (!id) return
        onSurveyDrop(id, dropTargetCollectionId)
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 5 }}
    >
      <SurveyDragHandle surveyId={survey.id} />
      <div
        style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={display}
      >
        {display}
      </div>
      <button type="button" onClick={onEdit} aria-label="Edit survey" title="Edit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, padding: 0, borderRadius: 6, background: 'rgba(77,126,255,0.08)', color: '#4D7EFF', border: '1px solid rgba(77,126,255,0.2)', cursor: 'pointer', flexShrink: 0 }}><PencilIcon /></button>
      <button type="button" onClick={onDelete} aria-label="Delete survey" title="Delete" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, padding: 0, borderRadius: 6, background: 'rgba(255,77,106,0.08)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', cursor: 'pointer', flexShrink: 0 }}><TrashIcon /></button>
    </div>
  )
}
