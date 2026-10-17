import React, { useState, useEffect } from 'react';
import {
  X,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Award,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  Star,
  Sparkles,
  Code2,
  HelpCircle,
  Eye,
  EyeOff,
  Sliders,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Job,
  WorkMode,
  PipelineRoundConfig,
  RecruiterInterviewQuestion,
  AssessmentQuestion,
  TestCase,
  RoundType,
} from '../types/index';
import { useNotification } from '../context/NotificationContext';

interface PostJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onJobCreated: (newJob?: Job) => void;
  jobToEdit?: Job | null;
  asTab?: boolean;
}

export const PostJobModal: React.FC<PostJobModalProps> = ({
  isOpen,
  onClose,
  token,
  onJobCreated,
  jobToEdit,
  asTab,
}) => {
  const { showError, showSuccess, showWarning } = useNotification();
  const [activeTab, setActiveTab] = useState<'basics' | 'criteria' | 'pipeline' | 'technical' | 'interview'>('basics');

  // Basics - Zero pre-filled defaults, completely given by recruiter
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [openings, setOpenings] = useState<number | ''>('');
  const [salaryPackage, setSalaryPackage] = useState('');
  const [registrationClosingDate, setRegistrationClosingDate] = useState(
    new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0]
  );
  const [workMode, setWorkMode] = useState<WorkMode>(WorkMode.HYBRID);
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [description, setDescription] = useState('');

  // Eligibility & Requirements - Completely given by recruiter
  const [eligibilityCriteria, setEligibilityCriteria] = useState('');
  const [experienceRequirements, setExperienceRequirements] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [requiredCertifications, setRequiredCertifications] = useState('');

  // Pipeline Rounds Config (Add / Remove / Modify rounds)
  const [rounds, setRounds] = useState<PipelineRoundConfig[]>([
    {
      roundNumber: 1,
      name: 'Resume Screening (ATS)',
      roundType: RoundType.RESUME_SCREENING,
      description: 'Automated AI ATS parsing against job skills, eligibility & experience.',
      minQualifyingScore: 65,
      evaluationCriteria: ['Skills alignment', 'Experience validation', 'Relevance score'],
      instructions: 'Upload an updated PDF resume for automated AI ATS parsing.',
    },
    {
      roundNumber: 2,
      name: 'Technical Assessment',
      roundType: RoundType.TECHNICAL_ASSESSMENT,
      description: 'Aptitude & domain MCQs + coding test with public & hidden test cases.',
      minQualifyingScore: 70,
      evaluationCriteria: ['Correctness', 'Algorithmic efficiency', 'Time complexity'],
      instructions: 'Complete online assessment within allocated duration using your 12-digit access code.',
    },
    {
      roundNumber: 3,
      name: 'AI Technical Interview',
      roundType: RoundType.AI_INTERVIEW,
      description: 'Real-time conversational voice interview with AI technical expert evaluator.',
      minQualifyingScore: 70,
      evaluationCriteria: ['Problem solving', 'System design', 'Depth of knowledge'],
      instructions: 'Camera & mic required. Priority recruiter questions evaluated first.',
    },
    {
      roundNumber: 4,
      name: 'Final Review & Selection',
      roundType: RoundType.FINAL_REVIEW,
      description: 'Hiring committee audit of all stage scores and offer rollout.',
      minQualifyingScore: 75,
      evaluationCriteria: ['Overall score aggregate', 'Hiring committee decision'],
      instructions: 'Formal job offer letter will be published to the portal.',
    },
  ]);

  // Round addition form state
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundType, setNewRoundType] = useState<RoundType>(RoundType.TECHNICAL_ASSESSMENT);
  const [newRoundDesc, setNewRoundDesc] = useState('');
  const [newRoundCutoff, setNewRoundCutoff] = useState(70);

  // Technical Assessment: MCQs (Aptitude & Technical) - NO predefault questions
  const [mcqQuestions, setMcqQuestions] = useState<AssessmentQuestion[]>([]);

  // Form for adding new MCQ
  const [newMcqText, setNewMcqText] = useState('');
  const [newMcqOptA, setNewMcqOptA] = useState('');
  const [newMcqOptB, setNewMcqOptB] = useState('');
  const [newMcqOptC, setNewMcqOptC] = useState('');
  const [newMcqOptD, setNewMcqOptD] = useState('');
  const [newMcqCorrectIdx, setNewMcqCorrectIdx] = useState(0);
  const [newMcqTopic, setNewMcqTopic] = useState('Technical & Aptitude');

  // Technical Assessment: Coding Questions (with 3 Shown and 5 Hidden Test Cases) - NO predefault questions
  const [codingQuestions, setCodingQuestions] = useState<AssessmentQuestion[]>([]);

  // State for adding a new coding question
  const [newCodeTitle, setNewCodeTitle] = useState('');
  const [newCodeDesc, setNewCodeDesc] = useState('');
  const [newCodeTemplate, setNewCodeTemplate] = useState('function solution(input) {\n  // Write your code here\n  return input;\n}');
  const [newCodeShownCases, setNewCodeShownCases] = useState<TestCase[]>([
    { input: '', expectedOutput: '', isHidden: false },
    { input: '', expectedOutput: '', isHidden: false },
    { input: '', expectedOutput: '', isHidden: false },
  ]);
  const [newCodeHiddenCases, setNewCodeHiddenCases] = useState<TestCase[]>([
    { input: '', expectedOutput: '', isHidden: true },
    { input: '', expectedOutput: '', isHidden: true },
    { input: '', expectedOutput: '', isHidden: true },
    { input: '', expectedOutput: '', isHidden: true },
    { input: '', expectedOutput: '', isHidden: true },
  ]);

  // AI Interview Settings & Recruiter Priority Questions - NO predefault questions
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [totalQuestions, setTotalQuestions] = useState<number>(6);
  const [customQuestions, setCustomQuestions] = useState<RecruiterInterviewQuestion[]>([]);

  // New Interview Question Form state
  const [newQText, setNewQText] = useState('');
  const [newQTopic, setNewQTopic] = useState('');
  const [newQPriority, setNewQPriority] = useState(true);

  // Authenticity
  const [isAuthenticVerified, setIsAuthenticVerified] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prepopulate form if jobToEdit is passed, else reset to blank
  useEffect(() => {
    if (jobToEdit) {
      setTitle(jobToEdit.title || '');
      setCompanyName(jobToEdit.company?.name || '');
      setOpenings(jobToEdit.openings || '');
      setSalaryPackage(jobToEdit.salaryPackage || '');
      setRegistrationClosingDate(jobToEdit.deadline ? jobToEdit.deadline.split('T')[0] : '');
      setWorkMode((jobToEdit.workMode as WorkMode) || WorkMode.HYBRID);
      const loc = jobToEdit.location || '';
      const standardLocations = ['Hyderabad', 'Chennai', 'Bangalore', 'Mysore', 'Delhi', 'Pune', 'Mumbai'];
      const matched = standardLocations.find(l => l.toLowerCase() === loc.toLowerCase());
      if (matched) {
        setLocation(matched);
        setCustomLocation('');
      } else if (loc) {
        setLocation('Others');
        setCustomLocation(loc);
      } else {
        setLocation('');
        setCustomLocation('');
      }
      setDescription(jobToEdit.description || '');
      setEligibilityCriteria(jobToEdit.qualification || '');
      setExperienceRequirements(jobToEdit.experience || '');
      setRequiredSkills(Array.isArray(jobToEdit.requiredSkills) ? jobToEdit.requiredSkills.join(', ') : '');
      setRequiredCertifications(Array.isArray(jobToEdit.requiredCertifications) ? jobToEdit.requiredCertifications.join(', ') : '');

      if (jobToEdit.rounds && Array.isArray(jobToEdit.rounds) && jobToEdit.rounds.length > 0) {
        setRounds(jobToEdit.rounds);
      }

      if (jobToEdit.durationMinutes) {
        setDurationMinutes(jobToEdit.durationMinutes);
      }
      if (jobToEdit.numQuestions) {
        setTotalQuestions(jobToEdit.numQuestions);
      }
      if (jobToEdit.interviewConfig?.customQuestions && Array.isArray(jobToEdit.interviewConfig.customQuestions)) {
        setCustomQuestions(jobToEdit.interviewConfig.customQuestions);
      }

      // First check if jobToEdit has questions directly
      if (jobToEdit.technicalAssessmentQuestions && Array.isArray(jobToEdit.technicalAssessmentQuestions) && jobToEdit.technicalAssessmentQuestions.length > 0) {
        const mcqs = jobToEdit.technicalAssessmentQuestions.filter((q: AssessmentQuestion) => q.type === 'MULTIPLE_CHOICE');
        const codings = jobToEdit.technicalAssessmentQuestions.filter((q: AssessmentQuestion) => q.type === 'CODING');
        setMcqQuestions(mcqs);
        setCodingQuestions(codings);
      }

      // Also fetch existing technical assessment questions for this job if any
      fetch(`/api/recruiter/assessments/job/${jobToEdit.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          const asmt = data.assessment || (Array.isArray(data) ? data[0] : null);
          if (asmt && Array.isArray(asmt.questions)) {
            const mcqs = asmt.questions.filter((q: AssessmentQuestion) => q.type === 'MULTIPLE_CHOICE');
            const codings = asmt.questions.filter((q: AssessmentQuestion) => q.type === 'CODING');
            if (mcqs.length > 0) setMcqQuestions(mcqs);
            if (codings.length > 0) setCodingQuestions(codings);
          }
        })
        .catch(() => {});
    } else {
      setTitle('');
      setCompanyName('');
      setOpenings('');
      setSalaryPackage('');
      setLocation('');
      setCustomLocation('');
      setDescription('');
      setEligibilityCriteria('');
      setExperienceRequirements('');
      setRequiredSkills('');
      setRequiredCertifications('');
      setMcqQuestions([]);
      setCodingQuestions([]);
      setCustomQuestions([]);
    }
  }, [jobToEdit, token, isOpen]);

  if (!isOpen) return null;

  // Pipeline Round management
  const handleAddRound = () => {
    if (!newRoundName.trim()) {
      showWarning('Please enter a round name', 'Validation');
      return;
    }
    const newRound: PipelineRoundConfig = {
      roundNumber: rounds.length + 1,
      name: newRoundName.trim(),
      roundType: newRoundType,
      description: newRoundDesc.trim() || `Custom round evaluating ${newRoundName.trim()}`,
      minQualifyingScore: newRoundCutoff,
      evaluationCriteria: ['Core competency', 'Performance'],
      instructions: 'Follow instructions provided by recruiter committee.',
    };
    setRounds([...rounds, newRound]);
    setNewRoundName('');
    setNewRoundDesc('');
    showSuccess(`Round ${rounds.length + 1} "${newRound.name}" added to pipeline!`, 'Round Added');
  };

  const handleRemoveRound = (idx: number) => {
    if (rounds.length <= 1) {
      showWarning('A recruitment pipeline must have at least one round.', 'Minimum Rounds');
      return;
    }
    const filtered = rounds.filter((_, i) => i !== idx);
    // Re-index round numbers
    const reindexed = filtered.map((r, i) => ({
      ...r,
      roundNumber: i + 1,
    }));
    setRounds(reindexed);
    showSuccess('Round removed from pipeline.', 'Pipeline Updated');
  };

  const handleUpdateRoundCutoff = (idx: number, score: number) => {
    const updated = [...rounds];
    updated[idx].minQualifyingScore = score;
    setRounds(updated);
  };

  // MCQ Handlers
  const handleAddMcq = () => {
    if (!newMcqText.trim() || !newMcqOptA.trim() || !newMcqOptB.trim() || !newMcqOptC.trim() || !newMcqOptD.trim()) {
      showWarning('Please provide question text and all 4 options (A, B, C, D).', 'Incomplete Question');
      return;
    }
    const mcq: AssessmentQuestion = {
      id: 'mcq_' + Date.now(),
      questionText: newMcqText.trim(),
      type: 'MULTIPLE_CHOICE',
      options: [newMcqOptA.trim(), newMcqOptB.trim(), newMcqOptC.trim(), newMcqOptD.trim()],
      correctOptionIndex: newMcqCorrectIdx,
      marks: 5,
      skillsTested: [newMcqTopic.trim() || 'Technical & Aptitude'],
    };
    setMcqQuestions([...mcqQuestions, mcq]);
    setNewMcqText('');
    setNewMcqOptA('');
    setNewMcqOptB('');
    setNewMcqOptC('');
    setNewMcqOptD('');
    setNewMcqCorrectIdx(0);
    showSuccess('MCQ question added successfully!', 'Question Saved');
  };

  const handleRemoveMcq = (id: string) => {
    setMcqQuestions(mcqQuestions.filter(q => q.id !== id));
  };

  // Coding Question Handlers
  const handleAddCodingQuestion = () => {
    if (!newCodeTitle.trim() || !newCodeDesc.trim()) {
      showWarning('Please enter problem title and problem description.', 'Incomplete Coding Problem');
      return;
    }

    const testCases: TestCase[] = [
      ...newCodeShownCases.map((tc, i) => ({
        ...tc,
        id: `tc_s_${i + 1}`,
        isHidden: false,
      })),
      ...newCodeHiddenCases.map((tc, i) => ({
        ...tc,
        id: `tc_h_${i + 1}`,
        isHidden: true,
      })),
    ];

    const codingQ: AssessmentQuestion = {
      id: 'code_' + Date.now(),
      questionText: `${newCodeTitle.trim()}: ${newCodeDesc.trim()}`,
      type: 'CODING',
      marks: 25,
      skillsTested: ['Algorithmic Problem Solving', 'Coding'],
      codingLanguage: 'javascript',
      codingTemplate: newCodeTemplate,
      testCases,
    };

    setCodingQuestions([...codingQuestions, codingQ]);
    setNewCodeTitle('');
    setNewCodeDesc('');
    setNewCodeShownCases([
      { input: '', expectedOutput: '', isHidden: false },
      { input: '', expectedOutput: '', isHidden: false },
      { input: '', expectedOutput: '', isHidden: false },
    ]);
    setNewCodeHiddenCases([
      { input: '', expectedOutput: '', isHidden: true },
      { input: '', expectedOutput: '', isHidden: true },
      { input: '', expectedOutput: '', isHidden: true },
      { input: '', expectedOutput: '', isHidden: true },
      { input: '', expectedOutput: '', isHidden: true },
    ]);
    showSuccess('Coding question with 3 shown and 5 hidden test cases added successfully!', 'Coding Problem Saved');
  };

  const handleRemoveCodingQuestion = (id: string) => {
    setCodingQuestions(codingQuestions.filter(q => q.id !== id));
  };

  // AI Interview Priority Question Handlers
  const handleAddQuestion = () => {
    if (!newQText.trim()) return;
    const q: RecruiterInterviewQuestion = {
      id: 'cq_' + Date.now(),
      question: newQText.trim(),
      questionText: newQText.trim(),
      topic: newQTopic.trim() || 'Core Engineering',
      isPriority: newQPriority,
    };
    setCustomQuestions([...customQuestions, q]);
    setNewQText('');
    setNewQTopic('');
    setNewQPriority(true);
  };

  const handleRemoveQuestion = (id: string) => {
    setCustomQuestions(customQuestions.filter(q => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !companyName.trim() || !description.trim()) {
      showWarning('Please fill in Job Title, Company Name, and Job Description.', 'Required Fields Missing');
      return;
    }
    if (openings === '' || Number(openings) <= 0) {
      showWarning('Please enter the Number of Openings.', 'Openings Required');
      return;
    }
    if (!salaryPackage.trim()) {
      showWarning('Please enter the Salary Package (e.g. 12 - 18 LPA).', 'Salary Package Required');
      return;
    }
    const finalLocation = (location === 'Others' ? (customLocation.trim() || 'Others') : location).trim();
    if (!finalLocation) {
      showWarning('Please select or specify the Job Location.', 'Location Required');
      return;
    }
    if (!isAuthenticVerified) {
      showWarning('Please confirm the transparency and authenticity notice checkbox before posting.', 'Verification Required');
      return;
    }

    setIsSubmitting(true);
    try {
      const skillsArray = requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
      const certsArray = requiredCertifications.split(',').map(c => c.trim()).filter(Boolean);

      // Auto-commit draft MCQ if user filled text and options but forgot to click "Add MCQ"
      const finalMcqs = [...mcqQuestions];
      if (newMcqText.trim() && newMcqOptA.trim() && newMcqOptB.trim()) {
        const autoMcq: AssessmentQuestion = {
          id: 'mcq_' + Date.now(),
          questionText: newMcqText.trim(),
          type: 'MULTIPLE_CHOICE',
          options: [
            newMcqOptA.trim(),
            newMcqOptB.trim(),
            newMcqOptC.trim() || 'Option C',
            newMcqOptD.trim() || 'Option D',
          ],
          correctOptionIndex: newMcqCorrectIdx,
          marks: 5,
          skillsTested: [newMcqTopic.trim() || 'Technical & Aptitude'],
        };
        finalMcqs.push(autoMcq);
      }

      // Auto-commit draft coding problem if user entered title/desc but forgot to click "Add Coding Problem"
      const finalCodings = [...codingQuestions];
      if (newCodeTitle.trim() || newCodeDesc.trim()) {
        const testCases: TestCase[] = [
          ...newCodeShownCases.map((tc, i) => ({
            ...tc,
            id: `tc_s_${i + 1}`,
            isHidden: false,
          })),
          ...newCodeHiddenCases.map((tc, i) => ({
            ...tc,
            id: `tc_h_${i + 1}`,
            isHidden: true,
          })),
        ];

        const autoCodingQ: AssessmentQuestion = {
          id: 'code_' + Date.now(),
          questionText: `${newCodeTitle.trim() || 'Coding Challenge'}${newCodeDesc.trim() ? ': ' + newCodeDesc.trim() : ''}`,
          type: 'CODING',
          marks: 25,
          skillsTested: ['Algorithmic Problem Solving', 'Coding'],
          codingLanguage: 'javascript',
          codingTemplate: newCodeTemplate,
          testCases,
        };
        finalCodings.push(autoCodingQ);
      }

      // Auto-commit draft interview question if user entered text but forgot to click "Add Priority Question"
      const finalCustomQuestions = [...customQuestions];
      if (newQText.trim()) {
        const autoQ: RecruiterInterviewQuestion = {
          id: 'cq_' + Date.now(),
          question: newQText.trim(),
          questionText: newQText.trim(),
          topic: newQTopic.trim() || 'Core Engineering',
          isPriority: newQPriority,
        };
        finalCustomQuestions.push(autoQ);
      }

      // Combine technical assessment questions (MCQs + Coding with 3 shown & 5 hidden test cases)
      const combinedTechnicalQuestions: AssessmentQuestion[] = [
        ...finalMcqs,
        ...finalCodings,
      ];

      const payload = {
        title: title.trim(),
        companyName: companyName.trim(),
        openings: Number(openings),
        salaryPackage: salaryPackage.trim(),
        registrationClosingDate,
        workMode,
        location: finalLocation,
        description: description.trim(),
        eligibilityCriteria: eligibilityCriteria.trim(),
        experienceRequirements: experienceRequirements.trim(),
        experience: experienceRequirements.trim(),
        requiredSkills: skillsArray,
        requiredCertifications: certsArray,
        rounds,
        durationMinutes: Number(durationMinutes) || 20,
        totalQuestions: Number(totalQuestions) || 5,
        numQuestions: Number(totalQuestions) || 5,
        numTechnicalQuestions: finalMcqs.length,
        numCodingQuestions: finalCodings.length,
        numMcqQuestions: finalMcqs.length,
        technicalAssessmentQuestions: combinedTechnicalQuestions,
        interviewSettings: {
          durationMinutes: Number(durationMinutes) || 20,
          totalQuestions: Number(totalQuestions) || 5,
          recruiterQuestions: finalCustomQuestions,
          targetTopics: skillsArray,
        },
        interviewConfig: {
          maxDurationMinutes: Number(durationMinutes) || 20,
          numQuestions: Number(totalQuestions) || 5,
          customQuestions: finalCustomQuestions,
        },
        minPackage: 800000,
        maxPackage: 1600000,
      };

      const url = jobToEdit ? `/api/jobs/${jobToEdit.id}` : '/api/jobs';
      const method = jobToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      setIsSubmitting(false);
      if (res.ok) {
        let createdOrUpdatedJob: Job | undefined = undefined;
        try {
          const d = await res.json();
          createdOrUpdatedJob = d?.job || (d?.id ? d : undefined);
        } catch {}

        if (createdOrUpdatedJob) {
          try {
            localStorage.setItem('ai_job_posted_event', JSON.stringify({
              job: createdOrUpdatedJob,
              timestamp: Date.now(),
            }));
            const bc = new BroadcastChannel('ai_job_channel');
            bc.postMessage({ type: 'JOB_CREATED', job: createdOrUpdatedJob });
            bc.close();
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'JOB_CREATED', job: createdOrUpdatedJob }, '*');
            }
          } catch {}
        }

        onJobCreated(createdOrUpdatedJob);
        onClose();
        showSuccess(
          jobToEdit
            ? `Job opening "${title.trim()}" updated successfully!`
            : 'Job opening published successfully with multi-round pipeline & technical test configuration!',
          jobToEdit ? 'Opening Updated' : 'Opening Published'
        );
      } else {
        const d = await res.json();
        showError(d.error || 'Failed to process job opening', 'Submission Error');
      }
    } catch (err) {
      setIsSubmitting(false);
      showError('Network error while processing opening. Please verify your connection.', 'Connection Error');
    }
  };

  return (
    <div className={asTab ? "w-full" : "fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm p-3 sm:p-6 flex justify-center items-start"}>
      <div className={`bg-white rounded-2xl border border-slate-200 w-full overflow-hidden flex flex-col ${asTab ? 'shadow-sm' : 'shadow-2xl max-w-4xl my-auto max-h-[90vh]'}`}>
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {jobToEdit ? `Edit Job Opening: ${jobToEdit.title}` : 'Post New Opportunity'}
              </h2>
              <p className="text-xs text-slate-500">
                Configure roles, pipeline rounds selection, technical MCQs, coding challenges (3 shown &amp; 5 hidden test cases), and priority AI questions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 bg-white px-4 sm:px-6 overflow-x-auto shrink-0 sticky top-0 z-10 no-scrollbar gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('basics')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'basics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Role &amp; Openings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('criteria')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'criteria'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Criteria &amp; Skills
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'pipeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Pipeline Rounds ({rounds.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('technical')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'technical'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            4. Technical Assessment ({mcqQuestions.length} MCQs, {codingQuestions.length} Coding)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('interview')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'interview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            5. AI Interview Priority Questions ({customQuestions.length})
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className={`p-4 sm:p-6 space-y-4 text-xs ${asTab ? '' : 'overflow-y-auto flex-1 min-h-0'}`}>
          {/* TAB 1: BASICS */}
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer (Distributed Systems)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Entity Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Stripe, Razorpay, Enterprise AI"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Number of Openings *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={openings}
                    onChange={e => setOpenings(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Salary Package (CTC) *</label>
                  <input
                    type="text"
                    required
                    value={salaryPackage}
                    onChange={e => setSalaryPackage(e.target.value)}
                    placeholder="e.g. 14 - 24 LPA"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Registration Closing Date</label>
                  <input
                    type="date"
                    value={registrationClosingDate}
                    onChange={e => setRegistrationClosingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Mode</label>
                  <select
                    value={workMode}
                    onChange={e => setWorkMode(e.target.value as WorkMode)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                  >
                    <option value={WorkMode.HYBRID}>Hybrid</option>
                    <option value={WorkMode.REMOTE}>Remote</option>
                    <option value={WorkMode.ONSITE}>Onsite</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location *</label>
                  <select
                    required
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Select Location</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Chennai">Chennai</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Mysore">Mysore</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Pune">Pune</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Others">Others</option>
                  </select>
                  {location === 'Others' && (
                    <input
                      type="text"
                      required
                      value={customLocation}
                      onChange={e => setCustomLocation(e.target.value)}
                      placeholder="Enter custom location"
                      className="w-full mt-2 px-3 py-1.5 rounded-lg border border-slate-300 outline-none focus:border-blue-500 bg-white text-xs"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Job Description *</label>
                <textarea
                  rows={5}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe key responsibilities, architectural scope, and expectations..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 2: CRITERIA */}
          {activeTab === 'criteria' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Eligibility Criteria</label>
                <textarea
                  rows={3}
                  value={eligibilityCriteria}
                  onChange={e => setEligibilityCriteria(e.target.value)}
                  placeholder="e.g. B.Tech/B.E. in Computer Science with minimum 65% aggregate; no active backlogs."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Experience Requirements</label>
                <input
                  type="text"
                  value={experienceRequirements}
                  onChange={e => setExperienceRequirements(e.target.value)}
                  placeholder="e.g. 2 - 5 Years in Backend/Distributed systems"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Required Skills (comma-separated)</label>
                <input
                  type="text"
                  value={requiredSkills}
                  onChange={e => setRequiredSkills(e.target.value)}
                  placeholder="e.g. Java, Spring Boot, Microservices, Redis, PostgreSQL, Kafka"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Required Certifications (comma-separated)</label>
                <input
                  type="text"
                  value={requiredCertifications}
                  onChange={e => setRequiredCertifications(e.target.value)}
                  placeholder="e.g. AWS Certified Solutions Architect, CKA, Oracle Java SE"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PIPELINE (ADD / REMOVE / CONFIGURE ROUNDS) */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">Custom Selection Pipeline Configuration</h4>
                  <p className="text-[11px] text-slate-500">
                    Add or remove rounds to tailor your interview pipeline. Configure qualifying cut-offs (%) for each stage.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200 text-[11px]">
                  {rounds.length} Active Rounds
                </span>
              </div>

              {/* Rounds List */}
              <div className="space-y-2.5">
                {rounds.map((r, idx) => (
                  <div
                    key={r.roundNumber}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                        R{r.roundNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{r.name}</span>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            {r.roundType}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{r.description}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-600">Cutoff:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={r.minQualifyingScore || 65}
                          onChange={e => handleUpdateRoundCutoff(idx, Number(e.target.value))}
                          className="w-14 px-2 py-1 rounded border border-slate-300 bg-white text-xs font-bold text-center"
                        />
                        <span className="text-[11px] font-semibold text-slate-500">%</span>
                      </div>

                      {/* Remove Round Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveRound(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Remove this round"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Round Box */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3 mt-4">
                <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                  <Plus className="w-4 h-4" />
                  <span>Add a New Stage to the Pipeline</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Round Name</label>
                    <input
                      type="text"
                      value={newRoundName}
                      onChange={e => setNewRoundName(e.target.value)}
                      placeholder="e.g. System Design Interview"
                      className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Round Type</label>
                    <select
                      value={newRoundType}
                      onChange={e => setNewRoundType(e.target.value as RoundType)}
                      className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                    >
                      <option value={RoundType.RESUME_SCREENING}>Resume Screening</option>
                      <option value={RoundType.TECHNICAL_ASSESSMENT}>Technical Assessment</option>
                      <option value={RoundType.AI_INTERVIEW}>AI Interview</option>
                      <option value={RoundType.FINAL_REVIEW}>Final Review &amp; Selection</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min Cutoff (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newRoundCutoff}
                      onChange={e => setNewRoundCutoff(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Round Description</label>
                  <input
                    type="text"
                    value={newRoundDesc}
                    onChange={e => setNewRoundDesc(e.target.value)}
                    placeholder="Brief evaluation criteria and instructions..."
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddRound}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Round</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TECHNICAL ASSESSMENT (MCQs + CODING WITH 3 SHOWN & 5 HIDDEN TEST CASES) */}
          {activeTab === 'technical' && (
            <div className="space-y-6">
              <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200">
                <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-indigo-600" />
                  <span>Round 2: Technical &amp; Aptitude Assessment Configuration</span>
                </h4>
                <p className="text-[11px] text-indigo-800/80 mt-0.5">
                  Post domain/aptitude questions with 4 options, and coding problems with 3 shown test cases and 5 hidden test cases. Once the resume passes Round 1, candidates unlock this test using a unique 12-digit code!
                </p>
              </div>

              {/* SECTION A: TECHNICAL & APTITUDE MCQS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">1. Aptitude &amp; Technical MCQs</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                      {mcqQuestions.length} Questions
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">4 options per question with single correct answer</span>
                </div>

                {/* MCQ List */}
                <div className="space-y-2.5">
                  {mcqQuestions.length === 0 ? (
                    <div className="p-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                      No aptitude or technical MCQs added yet. Use the form below to add questions for this role.
                    </div>
                  ) : (
                    mcqQuestions.map((q, idx) => (
                    <div key={q.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-slate-700 text-xs">Q{idx + 1}.</span>
                          <span className="font-semibold text-slate-900 text-xs">{q.questionText}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMcq(q.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer shrink-0"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 4 Options Grid */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {q.options?.map((opt, optIdx) => (
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
                    </div>
                  )))}
                </div>

                {/* Add MCQ Form */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-800 text-xs block">Add New Multiple Choice Question (4 Options)</span>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Question Text</label>
                    <input
                      type="text"
                      value={newMcqText}
                      onChange={e => setNewMcqText(e.target.value)}
                      placeholder="e.g. Which garbage collection algorithm is standard in HotSpot JVM?"
                      className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Option A</label>
                      <input
                        type="text"
                        value={newMcqOptA}
                        onChange={e => setNewMcqOptA(e.target.value)}
                        placeholder="Option A text"
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Option B</label>
                      <input
                        type="text"
                        value={newMcqOptB}
                        onChange={e => setNewMcqOptB(e.target.value)}
                        placeholder="Option B text"
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Option C</label>
                      <input
                        type="text"
                        value={newMcqOptC}
                        onChange={e => setNewMcqOptC(e.target.value)}
                        placeholder="Option C text"
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Option D</label>
                      <input
                        type="text"
                        value={newMcqOptD}
                        onChange={e => setNewMcqOptD(e.target.value)}
                        placeholder="Option D text"
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Correct Option</label>
                      <select
                        value={newMcqCorrectIdx}
                        onChange={e => setNewMcqCorrectIdx(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500 font-semibold"
                      >
                        <option value={0}>Option A (Correct)</option>
                        <option value={1}>Option B (Correct)</option>
                        <option value={2}>Option C (Correct)</option>
                        <option value={3}>Option D (Correct)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Topic / Category</label>
                      <input
                        type="text"
                        value={newMcqTopic}
                        onChange={e => setNewMcqTopic(e.target.value)}
                        placeholder="e.g. Core Java / Quantitative Aptitude"
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddMcq}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add MCQ Question</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION B: CODING QUESTIONS WITH 3 SHOWN & 5 HIDDEN TEST CASES */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">2. Coding Problems</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                      {codingQuestions.length} Questions
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Strictly 3 Shown Test Cases &amp; 5 Hidden Test Cases per problem
                  </span>
                </div>

                {/* Coding Questions List */}
                <div className="space-y-3">
                  {codingQuestions.length === 0 ? (
                    <div className="p-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                      No coding challenges added yet. Use the form below to configure a coding challenge with 3 shown and 5 hidden test cases.
                    </div>
                  ) : (
                    codingQuestions.map((cq, idx) => {
                    const shownCases = cq.testCases?.filter(tc => !tc.isHidden) || [];
                    const hiddenCases = cq.testCases?.filter(tc => tc.isHidden) || [];

                    return (
                      <div key={cq.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">Coding Problem #{idx + 1}</span>
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-mono font-semibold rounded">
                                JavaScript
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 mt-1 leading-relaxed">{cq.questionText}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCodingQuestion(cq.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer shrink-0"
                            title="Delete coding problem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Test Cases Count Summary */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[11px] mb-1">
                              <Eye className="w-3.5 h-3.5" />
                              <span>3 Shown Test Cases (Visible to Candidate)</span>
                            </div>
                            <div className="space-y-1">
                              {shownCases.map((tc, tcIdx) => (
                                <div key={tcIdx} className="text-[10px] font-mono text-slate-600">
                                  In: <code className="text-slate-900 font-semibold">{tc.input}</code> → Out: <code className="text-emerald-600 font-semibold">{tc.expectedOutput}</code>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] mb-1">
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>5 Hidden Test Cases (Private Verification)</span>
                            </div>
                            <div className="space-y-1">
                              {hiddenCases.map((tc, tcIdx) => (
                                <div key={tcIdx} className="text-[10px] font-mono text-slate-600">
                                  In: <code className="text-slate-900 font-semibold">{tc.input}</code> → Out: <code className="text-emerald-600 font-semibold">{tc.expectedOutput}</code>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }))}
                </div>

                {/* Add Coding Question Form */}
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                  <span className="font-bold text-emerald-950 text-xs block">
                    Post New Coding Challenge (Count, Problem &amp; 3 Shown + 5 Hidden Test Cases)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Problem Title</label>
                      <input
                        type="text"
                        value={newCodeTitle}
                        onChange={e => setNewCodeTitle(e.target.value)}
                        placeholder="e.g. Reverse Linked List / Max Subarray Sum"
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Language &amp; Template</label>
                      <input
                        type="text"
                        disabled
                        value="JavaScript (V8 Runtime)"
                        className="w-full px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-300 text-xs text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Problem Statement &amp; Constraints</label>
                    <textarea
                      rows={3}
                      value={newCodeDesc}
                      onChange={e => setNewCodeDesc(e.target.value)}
                      placeholder="Specify the problem requirements, input/output specifications, time complexity limits..."
                      className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* 3 Shown Test Cases Inputs */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>3 Shown Test Cases (Publicly visible to candidate during test)</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {newCodeShownCases.map((tc, i) => (
                        <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold text-slate-700 block">Shown Case #{i + 1}</span>
                          <input
                            type="text"
                            value={tc.input}
                            onChange={e => {
                              const updated = [...newCodeShownCases];
                              updated[i].input = e.target.value;
                              setNewCodeShownCases(updated);
                            }}
                            placeholder="Input"
                            className="w-full px-2 py-1 bg-white rounded border border-slate-300 text-[11px] font-mono"
                          />
                          <input
                            type="text"
                            value={tc.expectedOutput}
                            onChange={e => {
                              const updated = [...newCodeShownCases];
                              updated[i].expectedOutput = e.target.value;
                              setNewCodeShownCases(updated);
                            }}
                            placeholder="Expected Output"
                            className="w-full px-2 py-1 bg-white rounded border border-slate-300 text-[11px] font-mono text-emerald-600 font-bold"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5 Hidden Test Cases Inputs */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                      <span>5 Hidden Test Cases (Private verification against hardcoding)</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      {newCodeHiddenCases.map((tc, i) => (
                        <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold text-slate-700 block">Hidden #{i + 1}</span>
                          <input
                            type="text"
                            value={tc.input}
                            onChange={e => {
                              const updated = [...newCodeHiddenCases];
                              updated[i].input = e.target.value;
                              setNewCodeHiddenCases(updated);
                            }}
                            placeholder="Input"
                            className="w-full px-2 py-1 bg-white rounded border border-slate-300 text-[11px] font-mono"
                          />
                          <input
                            type="text"
                            value={tc.expectedOutput}
                            onChange={e => {
                              const updated = [...newCodeHiddenCases];
                              updated[i].expectedOutput = e.target.value;
                              setNewCodeHiddenCases(updated);
                            }}
                            placeholder="Expected Output"
                            className="w-full px-2 py-1 bg-white rounded border border-slate-300 text-[11px] font-mono text-emerald-600 font-bold"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddCodingQuestion}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Coding Problem with Testcases</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INTERVIEW (AI INTERVIEW & RECRUITER PRIORITY QUESTIONS) */}
          {activeTab === 'interview' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200">
                <h4 className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>AI Interview Priority &amp; Fallback Intelligence</span>
                </h4>
                <p className="text-[11px] text-blue-800/80 mt-1 leading-relaxed">
                  <strong>Priority Rule:</strong> Recruiter-specified questions configured below are asked <em>first</em> during the candidate’s AI voice interview. If no questions are posted by the recruiter (or once all priority questions are answered), the AI will autonomously formulate dynamic, package-calibrated interview questions based on the <strong>candidate’s verified resume, listed projects, and specific job role requirements</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Interview Time Limit (Minutes)</label>
                  <input
                    type="number"
                    min={10}
                    max={60}
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Number of AI Questions</label>
                  <input
                    type="number"
                    min={3}
                    max={15}
                    value={totalQuestions}
                    onChange={e => setTotalQuestions(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Recruiter Defined Questions */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Recruiter-Defined Priority Interview Questions ({customQuestions.length})</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Evaluated first before resume/project questions</span>
                </div>

                {/* Question List */}
                <div className="space-y-2 mb-3">
                  {customQuestions.length === 0 ? (
                    <div className="p-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                      No priority interview questions configured yet. Add questions below that the AI will ask and follow up on first.
                    </div>
                  ) : (
                    customQuestions.map(q => (
                    <div key={q.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                            {q.topic}
                          </span>
                          {q.isPriority && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              Priority Question (AI will ask deep follow-ups)
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-800">{q.question}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )))}
                </div>

                {/* Add Question input */}
                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                  <span className="text-[11px] font-bold text-blue-900 block">Add New Recruiter Priority Question</span>
                  <input
                    type="text"
                    value={newQText}
                    onChange={e => setNewQText(e.target.value)}
                    placeholder="Enter technical interview question..."
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={newQTopic}
                      onChange={e => setNewQTopic(e.target.value)}
                      placeholder="Topic (e.g. Distributed Systems, Kafka, Concurrency)"
                      className="w-1/2 px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                    />
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={newQPriority}
                        onChange={e => setNewQPriority(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Mark Priority</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Priority Question</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Authenticity Notice */}
          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-start gap-2.5 mt-4">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <label className="text-[11px] text-emerald-900 leading-snug cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={isAuthenticVerified}
                onChange={e => setIsAuthenticVerified(e.target.checked)}
                className="mr-2 rounded text-emerald-600"
              />
              <strong>Authenticity &amp; Transparency Notice:</strong> I verify that this job posting is authentic, transparent, and accurately specifies all pipeline rounds, technical questions, and evaluation criteria.
            </label>
          </div>

          {/* Footer actions with stage step navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              {activeTab !== 'basics' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'interview') setActiveTab('technical');
                    else if (activeTab === 'technical') setActiveTab('pipeline');
                    else if (activeTab === 'pipeline') setActiveTab('criteria');
                    else if (activeTab === 'criteria') setActiveTab('basics');
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  ← Previous Step
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeTab !== 'interview' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'basics') setActiveTab('criteria');
                    else if (activeTab === 'criteria') setActiveTab('pipeline');
                    else if (activeTab === 'pipeline') setActiveTab('technical');
                    else if (activeTab === 'technical') setActiveTab('interview');
                  }}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Next Step: {
                    activeTab === 'basics' ? '2. Criteria & Skills →' :
                    activeTab === 'criteria' ? '3. Pipeline Rounds →' :
                    activeTab === 'pipeline' ? '4. Technical Assessment →' :
                    '5. AI Interview →'
                  }
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : jobToEdit ? 'Update Job Posting' : 'Publish Job Opening'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
