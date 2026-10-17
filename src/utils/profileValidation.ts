import { CandidateProfile, User } from '../types/index';

export interface ProfileValidationResult {
  percentage: number;
  isComplete: boolean;
  sections: {
    personal: { completed: boolean; label: string; details: string };
    class10: { completed: boolean; label: string; details: string };
    secondary: { completed: boolean; label: string; details: string };
    degree: { completed: boolean; label: string; details: string };
    skills: { completed: boolean; label: string; details: string };
    resume: { completed: boolean; label: string; details: string };
  };
  missingFields: string[];
}

export function calculateProfileCompletion(
  user: User | null | undefined,
  profile: CandidateProfile | null | undefined
): ProfileValidationResult {
  const missingFields: string[] = [];

  // 1. Personal & Contact Info
  const hasName = Boolean(user?.fullName && user.fullName.trim().length > 0);
  const hasEmail = Boolean(user?.email && user.email.includes('@'));
  const hasPhone = Boolean(profile?.phone && profile.phone.trim().length >= 8);
  const hasLocation = Boolean(profile?.location && profile.location.trim().length >= 2);
  const personalCompleted = hasName && hasEmail && hasPhone && hasLocation;

  if (!hasPhone) missingFields.push('Phone Number');
  if (!hasLocation) missingFields.push('Current Location');

  // 2. Class 10th
  const edu = profile?.educationDetails;
  const has10th = Boolean(
    (edu?.class10School || edu?.class10Board) &&
    edu?.class10Percentage &&
    edu?.class10Year
  ) || Boolean(profile?.education && profile.education.toLowerCase().includes('10th'));

  if (!has10th) {
    missingFields.push('Class 10th (School, Board, Year & Percentage)');
  }

  // 3. Class 12th OR Diploma
  const isDiploma = edu?.secondaryType === 'Diploma';
  const hasDiploma = Boolean(
    edu?.diplomaCollege &&
    edu?.diplomaBranch &&
    edu?.diplomaPercentage &&
    edu?.diplomaYear
  );
  const has12th = Boolean(
    edu?.class12College &&
    edu?.class12Percentage &&
    edu?.class12Year
  );
  const secondaryCompleted = (isDiploma ? hasDiploma : has12th) || 
    Boolean(profile?.education && (profile.education.toLowerCase().includes('12th') || profile.education.toLowerCase().includes('diploma') || profile.education.toLowerCase().includes('intermediate')));

  if (!secondaryCompleted) {
    missingFields.push(isDiploma ? 'Diploma Details (College, Branch, Year & %)' : 'Class 12th / Intermediate (College, Stream, Year & %)');
  }

  // 4. Degree / Graduation
  const hasDegree = Boolean(
    edu?.degreeName &&
    edu?.degreeCollege &&
    edu?.degreeCgpa &&
    edu?.degreeYear
  ) || Boolean(profile?.education && (
    profile.education.toLowerCase().includes('b.tech') ||
    profile.education.toLowerCase().includes('bachelor') ||
    profile.education.toLowerCase().includes('b.e') ||
    profile.education.toLowerCase().includes('b.sc') ||
    profile.education.toLowerCase().includes('bca') ||
    profile.education.toLowerCase().includes('m.tech') ||
    profile.education.toLowerCase().includes('master')
  ));

  if (!hasDegree) {
    missingFields.push('Graduation / Degree (Degree Name, College, Specialization & CGPA)');
  }

  // 5. Skills
  const hasSkills = Boolean(profile?.skills && profile.skills.length >= 2);
  if (!hasSkills) {
    missingFields.push('Technical Skills (at least 2 required)');
  }

  // 6. Resume
  const hasResume = Boolean(
    (profile?.resumeFileName && profile.resumeFileName.length > 0) ||
    (profile?.resumeText && profile.resumeText.length > 50)
  );
  if (!hasResume) {
    missingFields.push('Resume Document (Upload PDF, DOCX, or TXT)');
  }

  // Weights (Total = 100%)
  // Personal: 15%
  // Class 10: 15%
  // Class 12/Diploma: 20%
  // Degree: 20%
  // Skills: 15%
  // Resume: 15%
  let score = 0;
  if (personalCompleted) score += 15;
  else if (hasPhone || hasLocation) score += 8;

  if (has10th) score += 15;
  if (secondaryCompleted) score += 20;
  if (hasDegree) score += 20;
  if (hasSkills) score += 15;
  if (hasResume) score += 15;

  const isComplete = personalCompleted && has10th && secondaryCompleted && hasDegree && hasSkills && hasResume;
  const percentage = isComplete ? 100 : Math.min(score, 95);

  return {
    percentage,
    isComplete,
    sections: {
      personal: {
        completed: personalCompleted,
        label: 'Personal & Contact',
        details: personalCompleted ? `${user?.fullName} • ${profile?.phone}` : 'Missing phone or location',
      },
      class10: {
        completed: has10th,
        label: '10th Class (SSC)',
        details: has10th ? `${edu?.class10School || 'Verified'} • ${edu?.class10Percentage || 'Done'}` : 'School, year & percentage required',
      },
      secondary: {
        completed: secondaryCompleted,
        label: isDiploma ? 'Diploma' : '12th / Intermediate',
        details: secondaryCompleted ? (isDiploma ? `${edu?.diplomaBranch} Diploma` : `${edu?.class12Stream || 'Intermediate'}`) : 'College, year & marks required',
      },
      degree: {
        completed: hasDegree,
        label: 'Graduation / Degree',
        details: hasDegree ? `${edu?.degreeName || 'Bachelor Degree'} (${edu?.degreeSpecialization || 'Engineering'})` : 'Degree, college, CGPA required',
      },
      skills: {
        completed: hasSkills,
        label: 'Technical Skills',
        details: hasSkills ? `${profile?.skills.length} skills listed` : 'Add your top skills',
      },
      resume: {
        completed: hasResume,
        label: 'Resume Document',
        details: hasResume ? (profile?.resumeFileName || 'Resume uploaded') : 'Upload resume for ATS audit',
      },
    },
    missingFields,
  };
}
