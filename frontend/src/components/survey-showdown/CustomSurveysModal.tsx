'use client'

import { useState } from 'react'
import { MAX_CUSTOM_SURVEYS } from '@/lib/constants'
import type { CustomSurvey, CustomCollection } from '@/lib/constants'

// Phase 9 API integration:
//   GET    /api/survey-showdown/custom-surveys           → load surveys + collections
//   POST   /api/survey-showdown/custom-surveys           → create { name, collectionId, questions }
//   PUT    /api/survey-showdown/custom-surveys/:id       → update survey
//   DELETE /api/survey-showdown/custom-surveys/:id       → delete survey
//   POST   /api/survey-showdown/custom-surveys/collections
//   PUT    /api/survey-showdown/custom-surveys/collections/:id
//   DELETE /api/survey-showdown/custom-surveys/collections/:id → surveys set to uncategorized

type Answer = { text: string; points: number }
type Question = { id: string; question: string; answers: Answer[] }

const emptyQuestion = (): Question => ({
  id: `q-${Date.now()}-${Math.random()}`,
  question: '',
  answers: [{ text: '', points: 30 }, { text: '', points: 20 }],
})
const emptyAnswer = (): Answer => ({ text: '', points: 10 })

interface CustomSurveysModalProps {
  surveys: CustomSurvey[]
  collections: CustomCollection[]
  onSaveSurvey: (survey: CustomSurvey) => void
  onDeleteSurvey: (id: string) => void
  onSaveCollection: (collection: CustomCollection) => void
  onDeleteCollection: (id: string) => void
  onClose: () => void
}

export default function CustomSurveysModal({
  surveys, collections, onSaveSurvey, onDeleteSurvey,
  onSaveCollection, onDeleteCollection, onClose,
}: CustomSurveysModalProps) {
  const [view, setView] = useState<'list' | 'survey' | 'collection'>('list')
  const [editingSurvey, setEditingSurvey] = useState<CustomSurvey | null>(null)
  const [editingCollection, setEditingCollection] = useState<CustomCollection | null>(null)
  const [sName, setSName] = useState('')
  const [sCollId, setSCollId] = useState<string | null>(null)
  const [sQuestions, setSQuestions] = useState<Question[]>([emptyQuestion()])
  const [cName, setCName] = useState('')
  const [cError, setCError] = useState('')
  const [sError, setSError] = useState('')

  function openCreateSurvey() { setEditingSurvey(null); setSName(''); setSCollId(null); setSQuestions([emptyQuestion()]); setSError(''); setView('survey') }
  function openEditSurvey(s: CustomSurvey) { setEditingSurvey(s); setSName(s.name); setSCollId(s.collectionId); setSQuestions(s.questions.map(q => ({ ...q, answers: [...q.answers] }))); setSError(''); setView('survey') }
  function openCreateCollection() { setEditingCollection(null); setCName(''); setCError(''); setView('collection') }
  function openEditCollection(c: CustomCollection) { setEditingCollection(c); setCName(c.name); setCError(''); setView('collection') }

  function saveSurvey() {
    if (!sName.trim()) { setSError('Survey name is required.'); return }
    const validQs = sQuestions.filter(q => q.question.trim() && q.answers.filter(a => a.text.trim()).length >= 2)
    if (!validQs.length) { setSError('At least one complete question with 2 answers required.'); return }
    const survey: CustomSurvey = {
      id: editingSurvey?.id || `s-${Date.now()}`,
      name: sName.trim(), collectionId: sCollId || null,
      questions: validQs.map(q => ({ ...q, answers: q.answers.filter(a => a.text.trim()) })),
    }
    onSaveSurvey(survey); setView('list')
  }

  function saveCollection() {
    if (!cName.trim()) { setCError('Collection name is required.'); return }
    const coll: CustomCollection = { id: editingCollection?.id || `c-${Date.now()}`, name: cName.trim() }
    onSaveCollection(coll); setView('list')
  }

  function updateQuestion(qi: number, field: string, val: string) { setSQuestions(qs => qs.map((q, i) => i === qi ? { ...q, [field]: val } : q)) }
  function updateAnswer(qi: number, ai: number, field: string, val: string) { setSQuestions(qs => qs.map((q, i) => i === qi ? { ...q, answers: q.answers.map((a, j) => j === ai ? { ...a, [field]: val } : a) } : q)) }
  function addQuestion() { setSQuestions(qs => [...qs, emptyQuestion()]) }
  function removeQuestion(qi: number) { setSQuestions(qs => qs.filter((_, i) => i !== qi)) }
  function addAnswer(qi: number) { setSQuestions(qs => qs.map((q, i) => i === qi && q.answers.length < 8 ? { ...q, answers: [...q.answers, emptyAnswer()] } : q)) }
  function removeAnswer(qi: number, ai: number) { setSQuestions(qs => qs.map((q, i) => i === qi ? { ...q, answers: q.answers.filter((_, j) => j !== ai) } : q)) }

  const atLimit = surveys.length >= MAX_CUSTOM_SURVEYS && !editingSurvey
  const fieldStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-body)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', outline: 'none' }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '24px', width: 'min(560px,96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* List View */}
        {view === 'list' && (<>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)' }}>✏ My Surveys</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={openCreateCollection} style={{ padding: '7px 12px', borderRadius: 9, fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '0.06em', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer' }}>+ Collection</button>
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
              return (
                <div key={c.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', flex: 1 }}>📁 {c.name} <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>({collSurveys.length})</span></div>
                    <button onClick={() => openEditCollection(c)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'transparent', color: 'var(--text-faint)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Edit</button>
                    <button onClick={() => onDeleteCollection(c.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'transparent', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Delete</button>
                  </div>
                  {collSurveys.map(s => <SurveyRow key={s.id} survey={s} collections={collections} onEdit={() => openEditSurvey(s)} onDelete={() => onDeleteSurvey(s.id)} onMove={cid => onSaveSurvey({ ...s, collectionId: cid })} />)}
                  {collSurveys.length === 0 && <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-body)' }}>No surveys in this collection.</div>}
                </div>
              )
            })}
            {surveys.filter(s => !s.collectionId).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>📋 Uncategorized</div>
                {surveys.filter(s => !s.collectionId).map(s => <SurveyRow key={s.id} survey={s} collections={collections} onEdit={() => openEditSurvey(s)} onDelete={() => onDeleteSurvey(s.id)} onMove={cid => onSaveSurvey({ ...s, collectionId: cid })} />)}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, flexShrink: 0, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
            {surveys.length} of {MAX_CUSTOM_SURVEYS} surveys used
          </div>
        </>)}

        {/* Survey Form */}
        {view === 'survey' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0 }}>
            <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)', flex: 1 }}>{editingSurvey ? 'Edit Survey' : 'New Survey'}</div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Survey Name</label>
                <input value={sName} onChange={e => setSName(e.target.value)} placeholder="e.g. Office Party Night" style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Collection <span style={{ fontSize: 9, color: 'var(--text-faint)', fontWeight: 400 }}>— optional</span></label>
                <select value={sCollId || ''} onChange={e => setSCollId(e.target.value || null)} style={{ ...fieldStyle, appearance: 'none' }}>
                  <option value="" style={{ background: '#0d1224', color: 'var(--text-muted)' }}>None</option>
                  {collections.map(c => <option key={c.id} value={c.id} style={{ background: '#0d1224', color: 'var(--text)' }}>{c.name}</option>)}
                </select>
              </div>
              {sQuestions.map((q, qi) => (
                <div key={q.id} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Question {qi + 1}</span>
                    {sQuestions.length > 1 && <button onClick={() => removeQuestion(qi)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,77,106,0.08)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Remove</button>}
                  </div>
                  <input value={q.question} onChange={e => updateQuestion(qi, 'question', e.target.value)} placeholder="Name something…" style={{ ...fieldStyle, marginBottom: 10 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.answers.map((a, ai) => (
                      <div key={ai} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input value={a.text} onChange={e => updateAnswer(qi, ai, 'text', e.target.value)} placeholder={`Answer ${ai + 1}`} style={{ ...fieldStyle, flex: 1 }} />
                        <input type="number" value={a.points} onChange={e => updateAnswer(qi, ai, 'points', String(Math.max(1, Math.min(100, Number(e.target.value) || 1))))} min={1} max={100} style={{ ...fieldStyle, width: 64, textAlign: 'center', padding: '9px 6px' }} />
                        {q.answers.length > 2 && <button onClick={() => removeAnswer(qi, ai)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,77,106,0.08)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>}
                      </div>
                    ))}
                  </div>
                  {q.answers.length < 8 && <button onClick={() => addAnswer(qi)} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-body)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>+ Add Answer</button>}
                </div>
              ))}
              <button onClick={addQuestion} style={{ padding: '10px', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-display)', letterSpacing: '0.06em', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>+ ADD QUESTION</button>
            </div>
          </div>
          {sError && <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.25)', fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A', flexShrink: 0 }}>{sError}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexShrink: 0 }}>
            <button onClick={() => setView('list')} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.06em', border: '1px solid rgba(255,255,255,0.08)' }}>CANCEL</button>
            <button onClick={saveSurvey} style={{ flex: 2, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(240,165,0,0.3)' }}>SAVE SURVEY</button>
          </div>
        </>)}

        {/* Collection Form */}
        {view === 'collection' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)', flex: 1 }}>{editingCollection ? 'Edit Collection' : 'New Collection'}</div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Collection Name</label>
            <input value={cName} onChange={e => setCName(e.target.value)} placeholder="e.g. Family Night" style={fieldStyle} autoFocus />
          </div>
          {cError && <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.25)', fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A' }}>{cError}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={() => setView('list')} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.06em', border: '1px solid rgba(255,255,255,0.08)' }}>CANCEL</button>
            <button onClick={saveCollection} style={{ flex: 2, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#4D7EFF,#2952CC)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(77,126,255,0.3)' }}>SAVE COLLECTION</button>
          </div>
        </>)}
      </div>
    </div>
  )
}

function SurveyRow({ survey, collections, onEdit, onDelete, onMove }: { survey: CustomSurvey; collections: CustomCollection[]; onEdit: () => void; onDelete: () => void; onMove: (cid: string | null) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 5 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{survey.name}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{survey.questions.length} question{survey.questions.length !== 1 ? 's' : ''}</div>
      </div>
      {collections.length > 0 && (
        <select value={survey.collectionId || ''} onChange={e => onMove(e.target.value || null)} style={{ padding: '4px 8px', borderRadius: 7, fontSize: 10, fontFamily: 'var(--font-body)', background: '#0d1224', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <option value="" style={{ background: '#0d1224', color: 'var(--text-muted)' }}>Uncategorized</option>
          {collections.map(c => <option key={c.id} value={c.id} style={{ background: '#0d1224', color: 'var(--text)' }}>{c.name}</option>)}
        </select>
      )}
      <button onClick={onEdit} style={{ fontSize: 10, padding: '4px 9px', borderRadius: 6, background: 'rgba(77,126,255,0.08)', color: '#4D7EFF', border: '1px solid rgba(77,126,255,0.2)', cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0 }}>Edit</button>
      <button onClick={onDelete} style={{ fontSize: 10, padding: '4px 9px', borderRadius: 6, background: 'rgba(255,77,106,0.08)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0 }}>Delete</button>
    </div>
  )
}
