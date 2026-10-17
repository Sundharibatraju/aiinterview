import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Code2,
  HelpCircle,
  Eye,
  EyeOff,
  Save,
  Check,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { TechnicalAssessment, AssessmentQuestion, TestCase } from '../types/index';
import { useNotification } from '../context/NotificationContext';

interface EditAssessmentQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: TechnicalAssessment | null;
  token: string | null;
  onSaved: (updated: TechnicalAssessment) => void;
}

export const EditAssessmentQuestionsModal: React.FC<EditAssessmentQuestionsModalProps> = ({
  isOpen,
  onClose,
  assessment,
  token,
  onSaved,
}) => {
  const { showSuccess, showError, showWarning } = useNotification();

  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passingScore, setPassingScore] = useState(70);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<'questions' | 'add_mcq' | 'add_code'>('questions');
  const [isSaving, setIsSaving] = useState(false);

  // New MCQ state
  const [mcqText, setMcqText] = useState('');
  const [mcqOptA, setMcqOptA] = useState('');
  const [mcqOptB, setMcqOptB] = useState('');
  const [mcqOptC, setMcqOptC] = useState('');
  const [mcqOptD, setMcqOptD] = useState('');
  const [mcqCorrectIdx, setMcqCorrectIdx] = useState(0);
  const [mcqTopic, setMcqTopic] = useState('Core Engineering');

  // New Coding Problem state
  const [codeTitle, setCodeTitle] = useState('');
  const [codeDesc, setCodeDesc] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeTemplate, setCodeTemplate] = useState('function solution(input) {\n  // Write your code here\n  return input;\n}');
  const [codeShownCases, setCodeShownCases] = useState<TestCase[]>([
    { input: '', expectedOutput: '', isHidden: false },
    { input: '', expectedOutput: '', isHidden: false },
    { input: '', expectedOutput: '', isHidden: false },
  ]);
  const [codeHiddenCases, setCodeHiddenCases] = useState<TestCase[]>([
    { input: '', expectedOutput: '', isHidden: true },
    { input: '', expectedOutput: '', isHidden: true },
    { input: '', expectedOutput: '', isHidden: true },
    { input: '', expectedOutput: '', isHidden: true },
    { input: '', expectedOutput: '', isHidden: true },
  ]);

  useEffect(() => {
    if (assessment) {
      setTitle(assessment.title || '');
      setDurationMinutes(assessment.durationMinutes || 45);
      setPassingScore(assessment.passingScore || 70);
      setQuestions(Array.isArray(assessment.questions) ? [...assessment.questions] : []);
      setActiveTab('questions');
    }
  }, [assessment, isOpen]);

  if (!isOpen || !assessment) return null;

  const handleAddMcq = () => {
    if (!mcqText.trim() || !mcqOptA.trim() || !mcqOptB.trim()) {
      showWarning('Please enter question text and at least options A and B', 'Validation Error');
      return;
    }
    const newQ: AssessmentQuestion = {
      id: 'mcq_' + Date.now(),
      questionText: mcqText.trim(),
      type: 'MULTIPLE_CHOICE',
      options: [
        mcqOptA.trim(),
        mcqOptB.trim(),
        mcqOptC.trim() || 'Option C',
        mcqOptD.trim() || 'Option D',
      ],
      correctOptionIndex: mcqCorrectIdx,
      marks: 5,
      skillsTested: [mcqTopic.trim() || 'Core Aptitude'],
    };

    setQuestions([...questions, newQ]);
    setMcqText('');
    setMcqOptA('');
    setMcqOptB('');
    setMcqOptC('');
    setMcqOptD('');
    setMcqCorrectIdx(0);
    setActiveTab('questions');
    showSuccess('Multiple choice question added to list.', 'Question Added');
  };

  const handleAddCoding = () => {
    if (!codeTitle.trim() || !codeDesc.trim()) {
      showWarning('Please provide problem title and problem description.', 'Validation Error');
      return;
    }

    const testCases: TestCase[] = [
      ...codeShownCases.map((tc, i) => ({
        ...tc,
        id: `tc_s_${i + 1}`,
        isHidden: false,
      })),
      ...codeHiddenCases.map((tc, i) => ({
        ...tc,
        id: `tc_h_${i + 1}`,
        isHidden: true,
      })),
    ];

    const newCodeQ: AssessmentQuestion = {
      id: 'code_' + Date.now(),
      questionText: `${codeTitle.trim()}: ${codeDesc.trim()}`,
      type: 'CODING',
      marks: 25,
      skillsTested: ['Algorithmic Problem Solving', 'Coding'],
      codingLanguage: codeLanguage,
      codingTemplate: codeTemplate,
      testCases,
    };

    setQuestions([...questions, newCodeQ]);
    setCodeTitle('');
    setCodeDesc('');
    setCodeShownCases([
      { input: '', expectedOutput: '', isHidden: false },
      { input: '', expectedOutput: '', isHidden: false },
      { input: '', expectedOutput: '', isHidden: false },
    ]);
    setCodeHiddenCases([
      { input: '', expectedOutput: '', isHidden: true },
      { input: '', expectedOutput: '', isHidden: true },
      { input: '', expectedOutput: '', isHidden: true },
      { input: '', expectedOutput: '', isHidden: true },
      { input: '', expectedOutput: '', isHidden: true },
    ]);
    setActiveTab('questions');
    showSuccess('Coding question added to list.', 'Coding Problem Added');
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSaveToDatabase = async () => {
    // Auto-commit draft MCQ if user has one typed
    let finalQuestions = [...questions];
    if (mcqText.trim() && mcqOptA.trim() && mcqOptB.trim()) {
      finalQuestions.push({
        id: 'mcq_' + Date.now(),
        questionText: mcqText.trim(),
        type: 'MULTIPLE_CHOICE',
        options: [
          mcqOptA.trim(),
          mcqOptB.trim(),
          mcqOptC.trim() || 'Option C',
          mcqOptD.trim() || 'Option D',
        ],
        correctOptionIndex: mcqCorrectIdx,
        marks: 5,
        skillsTested: [mcqTopic.trim() || 'Core Aptitude'],
      });
    }

    // Auto-commit draft Coding if user has one typed
    if (codeTitle.trim() || codeDesc.trim()) {
      const testCases: TestCase[] = [
        ...codeShownCases.map((tc, i) => ({
          ...tc,
          id: `tc_s_${i + 1}`,
          isHidden: false,
        })),
        ...codeHiddenCases.map((tc, i) => ({
          ...tc,
          id: `tc_h_${i + 1}`,
          isHidden: true,
        })),
      ];

      finalQuestions.push({
        id: 'code_' + Date.now(),
        questionText: `${codeTitle.trim() || 'Coding Challenge'}${codeDesc.trim() ? ': ' + codeDesc.trim() : ''}`,
        type: 'CODING',
        marks: 25,
        skillsTested: ['Algorithmic Problem Solving', 'Coding'],
        codingLanguage: codeLanguage,
        codingTemplate: codeTemplate,
        testCases,
      });
    }

    if (finalQuestions.length === 0) {
      showWarning('The assessment must contain at least one question.', 'Validation Warning');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/recruiter/assessments/${assessment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim() || assessment.title,
          durationMinutes: Number(durationMinutes) || 45,
          passingScore: Number(passingScore) || 70,
          questions: finalQuestions,
        }),
      });

      setIsSaving(false);
      if (res.ok) {
        const data = await res.json();
        showSuccess('Assessment questions successfully updated and saved in the database!', 'Saved to Database');
        onSaved(data.assessment || { ...assessment, title, durationMinutes, passingScore, questions: finalQuestions });
        onClose();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to update assessment', 'Save Error');
      }
    } catch (err: any) {
      setIsSaving(false);
      showError('Network error while saving assessment. Please try again.', 'Connection Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs p-3 sm:p-6 flex justify-center items-center">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Manage Assessment Questions &amp; Test Cases
              </h3>
              <p className="text-xs text-slate-500">
                Directly configure MCQs and coding challenges with public &amp; hidden test cases stored in the database.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Assessment Settings Bar */}
        <div className="px-5 py-3 bg-slate-100/70 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Assessment Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Duration (Minutes)</label>
            <input
              type="number"
              min={10}
              max={180}
              value={durationMinutes}
              onChange={e => setDurationMinutes(Number(e.target.value))}
              className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Passing Score (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={passingScore}
              onChange={e => setPassingScore(Number(e.target.value))}
              className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 px-5 bg-white shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'questions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Configured Questions ({questions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('add_mcq')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'add_mcq'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add MCQ Question</span>
          </button>
          <button
            onClick={() => setActiveTab('add_code')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'add_code'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>+ Add Coding Challenge</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: CONFIGURED QUESTIONS LIST */}
          {activeTab === 'questions' && (
            <div className="space-y-3">
              {questions.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-800 text-xs">No Questions Currently Configured</p>
                  <p className="text-[11px] text-slate-500 mt-1 mb-4">
                    Add MCQs or Coding Challenges using the tabs above to configure the questions candidates will receive.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setActiveTab('add_mcq')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                    >
                      + Add MCQ
                    </button>
                    <button
                      onClick={() => setActiveTab('add_code')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                    >
                      + Add Coding Problem
                    </button>
                  </div>
                </div>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id || idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">Question #{idx + 1}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              q.type === 'CODING'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {q.type === 'CODING' ? 'Coding Challenge' : 'Multiple Choice'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">{q.marks || 5} Marks</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-1">{q.questionText}</p>
                      </div>

                      <button
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* MCQ Options */}
                    {q.type === 'MULTIPLE_CHOICE' && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                              q.correctOptionIndex === optIdx
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px] shrink-0 font-bold">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="truncate">{opt}</span>
                            {q.correctOptionIndex === optIdx && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Coding specs & test cases */}
                    {q.type === 'CODING' && (
                      <div className="space-y-2 pt-1">
                        {q.codingTemplate && (
                          <div className="bg-slate-900 rounded-lg p-2.5 font-mono text-[10px] text-slate-200 overflow-x-auto max-h-24">
                            <pre>{q.codingTemplate}</pre>
                          </div>
                        )}
                        {q.testCases && q.testCases.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <span className="text-[10px] font-bold text-blue-700 block mb-1">
                                Shown Test Cases ({q.testCases.filter(tc => !tc.isHidden).length}):
                              </span>
                              <div className="space-y-0.5">
                                {q.testCases.filter(tc => !tc.isHidden).map((tc, tcIdx) => (
                                  <div key={tcIdx} className="text-[10px] font-mono text-slate-600 truncate">
                                    In: <code className="text-slate-900 font-semibold">{tc.input}</code> → Out: <code className="text-emerald-600 font-semibold">{tc.expectedOutput}</code>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <span className="text-[10px] font-bold text-amber-700 block mb-1">
                                Hidden Anti-Cheat Test Cases ({q.testCases.filter(tc => tc.isHidden).length}):
                              </span>
                              <div className="space-y-0.5">
                                {q.testCases.filter(tc => tc.isHidden).map((tc, tcIdx) => (
                                  <div key={tcIdx} className="text-[10px] font-mono text-slate-600 truncate">
                                    In: <code className="text-slate-900 font-semibold">{tc.input}</code> → Out: <code className="text-emerald-600 font-semibold">{tc.expectedOutput}</code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: ADD MCQ */}
          {activeTab === 'add_mcq' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-900 text-xs block">Add Multiple Choice Question</span>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Question Statement</label>
                <input
                  type="text"
                  value={mcqText}
                  onChange={e => setMcqText(e.target.value)}
                  placeholder="e.g. Which index structure in PostgreSQL is optimized for full-text search?"
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Option A</label>
                  <input
                    type="text"
                    value={mcqOptA}
                    onChange={e => setMcqOptA(e.target.value)}
                    placeholder="Option A"
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Option B</label>
                  <input
                    type="text"
                    value={mcqOptB}
                    onChange={e => setMcqOptB(e.target.value)}
                    placeholder="Option B"
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Option C</label>
                  <input
                    type="text"
                    value={mcqOptC}
                    onChange={e => setMcqOptC(e.target.value)}
                    placeholder="Option C"
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Option D</label>
                  <input
                    type="text"
                    value={mcqOptD}
                    onChange={e => setMcqOptD(e.target.value)}
                    placeholder="Option D"
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Correct Answer</label>
                  <select
                    value={mcqCorrectIdx}
                    onChange={e => setMcqCorrectIdx(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-semibold outline-none focus:border-indigo-500"
                  >
                    <option value={0}>Option A (Correct)</option>
                    <option value={1}>Option B (Correct)</option>
                    <option value={2}>Option C (Correct)</option>
                    <option value={3}>Option D (Correct)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Domain / Topic</label>
                  <input
                    type="text"
                    value={mcqTopic}
                    onChange={e => setMcqTopic(e.target.value)}
                    placeholder="e.g. Databases / Data Structures"
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAddMcq}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question to List</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ADD CODING PROBLEM */}
          {activeTab === 'add_code' && (
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
              <span className="font-bold text-emerald-950 text-xs block">
                Add Coding Problem (with 3 Shown and 5 Hidden Test Cases)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Problem Title</label>
                  <input
                    type="text"
                    value={codeTitle}
                    onChange={e => setCodeTitle(e.target.value)}
                    placeholder="e.g. Reverse Linked List"
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Language</label>
                  <select
                    value={codeLanguage}
                    onChange={e => setCodeLanguage(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-semibold outline-none focus:border-emerald-500"
                  >
                    <option value="javascript">JavaScript / TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Problem Description</label>
                <textarea
                  rows={2}
                  value={codeDesc}
                  onChange={e => setCodeDesc(e.target.value)}
                  placeholder="Detailed problem specification, constraints, and requirements..."
                  className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Starter Code Template</label>
                <textarea
                  rows={3}
                  value={codeTemplate}
                  onChange={e => setCodeTemplate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 text-emerald-400 font-mono rounded-lg border border-slate-700 text-xs outline-none"
                />
              </div>

              {/* 3 Shown Test Cases */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>3 Shown Test Cases (Publicly visible to candidate)</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {codeShownCases.map((tc, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-blue-200 space-y-1">
                      <span className="text-[10px] font-bold text-blue-700">Case #{idx + 1}</span>
                      <input
                        type="text"
                        value={tc.input}
                        onChange={e => {
                          const updated = [...codeShownCases];
                          updated[idx].input = e.target.value;
                          setCodeShownCases(updated);
                        }}
                        placeholder="Input (e.g. [2,7,11,15], 9)"
                        className="w-full px-2 py-1 text-[11px] font-mono rounded border border-slate-200"
                      />
                      <input
                        type="text"
                        value={tc.expectedOutput}
                        onChange={e => {
                          const updated = [...codeShownCases];
                          updated[idx].expectedOutput = e.target.value;
                          setCodeShownCases(updated);
                        }}
                        placeholder="Expected Output (e.g. [0,1])"
                        className="w-full px-2 py-1 text-[11px] font-mono rounded border border-slate-200"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 5 Hidden Test Cases */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>5 Hidden Test Cases (Private server-side test suite)</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {codeHiddenCases.map((tc, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-amber-200 space-y-1">
                      <span className="text-[10px] font-bold text-amber-700">Hidden #{idx + 1}</span>
                      <input
                        type="text"
                        value={tc.input}
                        onChange={e => {
                          const updated = [...codeHiddenCases];
                          updated[idx].input = e.target.value;
                          setCodeHiddenCases(updated);
                        }}
                        placeholder="Hidden Input"
                        className="w-full px-2 py-1 text-[11px] font-mono rounded border border-slate-200"
                      />
                      <input
                        type="text"
                        value={tc.expectedOutput}
                        onChange={e => {
                          const updated = [...codeHiddenCases];
                          updated[idx].expectedOutput = e.target.value;
                          setCodeHiddenCases(updated);
                        }}
                        placeholder="Hidden Expected Output"
                        className="w-full px-2 py-1 text-[11px] font-mono rounded border border-slate-200"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAddCoding}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Coding Problem to List</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Synchronizing to Database...' : 'Save Changes to Database'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
