import { Subject, Category, Material, TeacherAccount, StudentAccount } from '../types';

/**
 * Normalizes class strings so variations match seamlessly:
 * e.g. "Kelas 8.1", "8.1", "8-1", "8 1", "VIII.1", "VIII-1", "VIII 1", "8.1 " -> "8.1"
 * e.g. "Kelas 7A", "7A", "7-A", "VII A", "VII-A" -> "7A"
 * e.g. "9.2", "9-2", "IX.2", "Kelas 9.2" -> "9.2"
 */
export function normalizeClassName(raw: string | undefined | null): string {
  if (!raw) return '';
  let str = String(raw).trim().toUpperCase();
  
  // Remove prefixes like "KELAS", "ROMBEL", "TINGKAT", "CLASS", "KLAS"
  str = str.replace(/^(KELAS|ROMBEL|TINGKAT|CLASS|KLAS)\s*/i, '').trim();

  // Convert Roman numerals at start to numbers
  // XII -> 12, XI -> 11, X -> 10, IX -> 9, VIII -> 8, VII -> 7, VI -> 6, etc.
  str = str
    .replace(/^XII(\b|\.|\s|-|_)/i, '12$1')
    .replace(/^XI(\b|\.|\s|-|_)/i, '11$1')
    .replace(/^X(\b|\.|\s|-|_)/i, '10$1')
    .replace(/^IX(\b|\.|\s|-|_)/i, '9$1')
    .replace(/^VIII(\b|\.|\s|-|_)/i, '8$1')
    .replace(/^VII(\b|\.|\s|-|_)/i, '7$1')
    .replace(/^VI(\b|\.|\s|-|_)/i, '6$1')
    .replace(/^V(\b|\.|\s|-|_)/i, '5$1')
    .replace(/^IV(\b|\.|\s|-|_)/i, '4$1');

  // Standardize separators: replace dashes, underscores, spaces around dots/numbers
  // e.g. "8 - 1" -> "8.1", "8_1" -> "8.1", "8 1" -> "8.1"
  str = str.replace(/[\s\-_]+/g, '.');
  
  // If format is like "8.A" -> "8A", or "8.1" -> "8.1"
  str = str.replace(/^(\d+)\.([A-Z])$/, '$1$2');

  return str;
}

/**
 * Extracts pure grade level number/identifier (e.g. '7', '8', '9', '10', 'all')
 * from class strings (e.g. '8.1' -> '8', 'smp-8' -> '8', 'Kelas IX' -> '9', 'umum' -> 'all')
 */
export function extractGradeLevel(input: string | undefined | null): string {
  if (!input) return 'all';
  const clean = String(input).trim().toUpperCase();
  if (
    clean === 'ALL' ||
    clean === 'SEMUA' ||
    clean === 'UMUM' ||
    clean === '*' ||
    clean === 'ADAPTIF' ||
    clean === ''
  ) {
    return 'all';
  }

  // Check prefixes like SMP-8, SMA-10, SD-6, etc.
  const prefixMatch = clean.match(/(?:SMP|SMA|SMK|SD|KELAS|TINGKAT|GRADE)[-_.\s]*(\d+)/i);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1];
  }

  // Normalized roman numeral or direct class notation
  const normalized = normalizeClassName(clean);
  const leadingNum = normalized.match(/^(\d+)/);
  if (leadingNum && leadingNum[1]) {
    return leadingNum[1];
  }

  const anyDigit = clean.match(/\b(\d+)\b/);
  if (anyDigit && anyDigit[1]) {
    return anyDigit[1];
  }

  return clean.toLowerCase();
}

/**
 * Matches any raw grade identifier to the canonical grade ID in a master list
 */
export function matchGradeId(
  value: string | undefined | null,
  gradesList: Array<{ id: string; label?: string }>
): string {
  if (!value) return 'all';
  const clean = String(value).trim();
  const cleanLower = clean.toLowerCase();
  if (
    cleanLower === 'all' ||
    cleanLower === 'umum' ||
    cleanLower === 'semua' ||
    cleanLower === '*' ||
    cleanLower === 'adaptif' ||
    cleanLower === ''
  ) {
    return 'all';
  }
  // 1. Direct match ID (case-insensitive)
  const directMatch = gradesList.find((g) => g.id.toLowerCase() === cleanLower);
  if (directMatch) return directMatch.id;

  // 2. Extracted grade level match (e.g. 'smp-8' -> '8' vs g.id='8')
  const valLevel = extractGradeLevel(clean);
  if (valLevel && valLevel !== 'all') {
    const levelMatch = gradesList.find((g) => extractGradeLevel(g.id) === valLevel);
    if (levelMatch) return levelMatch.id;
  }

  return clean;
}

/**
 * Checks if a target grade matches a student's class
 */
export function isGradeMatchStudent(
  targetGrade: string | undefined | null,
  studentClass: string | undefined | null
): boolean {
  if (!targetGrade || targetGrade === 'all' || targetGrade === 'umum' || targetGrade === 'semua' || targetGrade === '*') {
    return true;
  }
  if (!studentClass) return true;

  const targetGradeNum = extractGradeLevel(targetGrade);
  if (targetGradeNum === 'all' || !targetGradeNum) {
    return true;
  }

  const studentGradeNum = extractGradeLevel(studentClass);
  if (studentGradeNum === 'all' || !studentGradeNum) {
    return true;
  }

  return targetGradeNum === studentGradeNum;
}

/**
 * Extracts assigned classes list from TeacherAccount safely
 * Handles Array of strings, comma-separated strings, or single string.
 */
export function getTeacherAssignedClasses(teacher: TeacherAccount | undefined | null): string[] {
  if (!teacher) return [];
  const assigned = teacher.assignedClasses;
  if (!assigned) return [];
  if (Array.isArray(assigned)) {
    return assigned
      .flatMap((item) =>
        typeof item === 'string' ? item.split(',').map((s) => s.trim()).filter(Boolean) : []
      )
      .filter(Boolean);
  }
  if (typeof assigned === 'string') {
    return (assigned as string)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Checks if two class strings match (exact, case-insensitive, or normalized)
 */
export function isClassMatch(classA: string | undefined | null, classB: string | undefined | null): boolean {
  if (!classA || !classB) return false;
  const aClean = String(classA).trim().toUpperCase();
  const bClean = String(classB).trim().toUpperCase();
  if (aClean === bClean) return true;
  if (aClean === 'ALL' || aClean === 'SEMUA' || aClean === '*' || bClean === 'ALL' || bClean === 'SEMUA' || bClean === '*') return true;
  
  const normA = normalizeClassName(classA);
  const normB = normalizeClassName(classB);
  if (normA && normB && normA === normB) return true;

  // Grade-level matching:
  // If either class represents a general grade level (e.g. '8', 'Kelas 8', 'VIII')
  // and the other is a class within that grade (e.g. '8.1', '8A', 'VIII-1'), they match seamlessly.
  const gradeA = extractGradeLevel(classA);
  const gradeB = extractGradeLevel(classB);
  if (gradeA && gradeB && gradeA !== 'all' && gradeB !== 'all' && gradeA === gradeB) {
    const isPureGradeA = /^\d+$/.test(normA) || normA === gradeA;
    const isPureGradeB = /^\d+$/.test(normB) || normB === gradeB;
    if (isPureGradeA || isPureGradeB) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a teacher teaches a given student's class.
 * - If teacher has assignedClasses defined with items:
 *   Returns true ONLY if any assigned class matches student's class.
 * - If teacher has NO assignedClasses defined or empty array:
 *   Returns true (unrestricted / general teacher).
 */
export function doesTeacherTeachClass(teacher: TeacherAccount | undefined | null, studentClass: string | undefined | null): boolean {
  if (!teacher) return true;
  if (!studentClass) return true;
  const assigned = getTeacherAssignedClasses(teacher);
  if (assigned.length === 0) {
    return true; // Unrestricted / general teacher
  }
  return assigned.some((cls) => isClassMatch(cls, studentClass));
}

/**
 * Finds all teachers assigned to or associated with a subject.
 */
export function getTeachersForSubject(subj: Subject, teachers: TeacherAccount[]): TeacherAccount[] {
  if (!subj || !teachers || teachers.length === 0) return [];
  const subjId = (subj.id || '').trim().toLowerCase();
  const subjName = (subj.name || '').trim().toLowerCase();
  const subjCode = (subj.code || '').trim().toLowerCase();

  return teachers.filter((t) => {
    if (!t) return false;
    const tSubjId = (t.subjectId || '').trim().toLowerCase();

    // Check direct subjectId match (ID, Code, or Name)
    if (tSubjId && (tSubjId === subjId || tSubjId === subjCode || tSubjId === subjName)) {
      return true;
    }

    // Check if subject was created by this teacher
    if (subj.createdBy) {
      const createdBy = subj.createdBy.trim().toLowerCase();
      if (
        (t.id && t.id.toLowerCase() === createdBy) ||
        (t.username && t.username.toLowerCase() === createdBy) ||
        (t.name && t.name.toLowerCase() === createdBy)
      ) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Filters materials, categories, and subjects visible for a student's class.
 */
export function filterContentForStudent(
  student: StudentAccount | undefined | null,
  teachers: TeacherAccount[] = [],
  subjects: Subject[] = [],
  categories: Category[] = [],
  materials: Material[] = []
) {
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeMaterials = Array.isArray(materials) ? materials : [];

  if (!student || !student.kelas) {
    return {
      filteredSubjects: safeSubjects,
      filteredCategories: safeCategories,
      filteredMaterials: safeMaterials,
    };
  }

  const studentClass = student.kelas;

  // Build teacher lookup map by id, username, name, and nip
  const teacherMap = new Map<string, TeacherAccount>();
  safeTeachers.forEach((t) => {
    if (t.id) teacherMap.set(t.id.toLowerCase().trim(), t);
    if (t.username) {
      const u = t.username.toLowerCase().trim();
      teacherMap.set(u, t);
      teacherMap.set(`@${u}`, t);
    }
    if (t.name) teacherMap.set(t.name.toLowerCase().trim(), t);
    if (t.nip) teacherMap.set(t.nip.toLowerCase().trim(), t);
  });

  // Helper to find teacher for a createdBy value
  const getTeacherForCreator = (creatorId?: string): TeacherAccount | undefined => {
    if (!creatorId) return undefined;
    const clean = creatorId.trim().toLowerCase();
    return teacherMap.get(clean);
  };

  // Helper to check if a creator is allowed for this student's class
  const isCreatorAllowedForStudent = (creatorId?: string, targetGrade?: string): boolean => {
    if (!creatorId || creatorId === 'admin') return true;
    const teacher = getTeacherForCreator(creatorId);
    if (!teacher) return true;

    // 1. Direct class match
    if (doesTeacherTeachClass(teacher, studentClass)) return true;

    // 2. Target grade match for curriculum consistency
    if (targetGrade && isGradeMatchStudent(targetGrade, studentClass)) {
      return true;
    }

    // 3. Grade-level match if teacher teaches other classes in the same grade
    const teacherClasses = getTeacherAssignedClasses(teacher);
    if (teacherClasses.length === 0) return true;
    const studentGrade = extractGradeLevel(studentClass);
    if (studentGrade && studentGrade !== 'all') {
      const teachesSameGrade = teacherClasses.some((cls) => extractGradeLevel(cls) === studentGrade);
      if (teachesSameGrade) return true;
    }

    return false;
  };

  // 1. FILTER SUBJECTS:
  const filteredSubjects = safeSubjects.filter((subj) => {
    if (!subj) return false;
    // Check subject creator: if author is teacher, only restrict if no subject teacher teaches this class
    if (subj.createdBy && !isCreatorAllowedForStudent(subj.createdBy)) {
      const subjTeachers = getTeachersForSubject(subj, safeTeachers);
      if (subjTeachers.length > 0) {
        const anyTeachesThisClass = subjTeachers.some((t) => doesTeacherTeachClass(t, studentClass));
        if (!anyTeachesThisClass) {
          return false;
        }
      }
    }

    // Check all teachers linked to this subject
    const subjTeachers = getTeachersForSubject(subj, safeTeachers);

    if (subjTeachers.length > 0) {
      // Are there teachers with class restrictions?
      const teachersWithRestrictions = subjTeachers.filter((t) => {
        const classes = getTeacherAssignedClasses(t);
        return classes.length > 0;
      });

      // If all teachers of this subject have class restrictions:
      if (teachersWithRestrictions.length === subjTeachers.length) {
        // Does ANY teacher teach this student's class?
        const anyTeachesThisClass = teachersWithRestrictions.some((t) =>
          doesTeacherTeachClass(t, studentClass)
        );
        if (!anyTeachesThisClass) {
          // No teacher of this subject teaches studentClass -> HIDE SUBJECT
          return false;
        }
      }
    }

    return true;
  });

  const visibleSubjectIds = new Set(
    (filteredSubjects || []).map((s) => (s && s.id ? s.id.toLowerCase().trim() : '')).filter(Boolean)
  );
  (filteredSubjects || []).forEach((s) => {
    if (!s) return;
    if (s.code) visibleSubjectIds.add(s.code.toLowerCase().trim());
    if (s.name) visibleSubjectIds.add(s.name.toLowerCase().trim());
  });

  // 2. FILTER CATEGORIES:
  const filteredCategories = safeCategories.filter((cat) => {
    if (!cat) return false;
    // Check publish status (hide draft/unpublished categories from student view)
    if (cat.isPublished === false) {
      return false;
    }

    const catGradeClean = String(cat.targetGrade || '').trim().toLowerCase();
    const isCatSpecificGrade =
      cat.targetGrade &&
      catGradeClean !== 'all' &&
      catGradeClean !== 'umum' &&
      catGradeClean !== 'semua' &&
      catGradeClean !== '*' &&
      catGradeClean !== 'adaptif' &&
      catGradeClean !== '';

    // Strict targetGrade check against student's class
    if (isCatSpecificGrade) {
      if (!isGradeMatchStudent(cat.targetGrade, studentClass)) {
        return false;
      }
    } else {
      // If category has no specific grade ('all'/'umum'), verify if its materials are all restricted to other grades
      const allCatMats = safeMaterials.filter((m) => m && m.categoryId === cat.id && m.isPublished !== false);
      if (allCatMats.length > 0) {
        const hasEligibleMaterial = allCatMats.some((mat) => {
          const matGradeClean = String(mat.targetGrade || '').trim().toLowerCase();
          const isMatSpecific =
            mat.targetGrade &&
            matGradeClean !== 'all' &&
            matGradeClean !== 'umum' &&
            matGradeClean !== 'semua' &&
            matGradeClean !== '*' &&
            matGradeClean !== 'adaptif' &&
            matGradeClean !== '';
          if (!isMatSpecific) return true; // Universal material
          return isGradeMatchStudent(mat.targetGrade, studentClass);
        });
        if (!hasEligibleMaterial) {
          return false;
        }
      }
    }

    // Check creator with targetGrade awareness
    if (cat.createdBy && !isCreatorAllowedForStudent(cat.createdBy, cat.targetGrade)) {
      return false;
    }

    // Check parent subject visibility
    const catSubjId = (cat.subjectId || 'informatika').toLowerCase().trim();
    if (!visibleSubjectIds.has(catSubjId)) {
      const parentSubj = safeSubjects.find(
        (s) =>
          s &&
          ((s.id && s.id.toLowerCase() === catSubjId) ||
            (s.code && s.code.toLowerCase() === catSubjId) ||
            (s.name && s.name.toLowerCase() === catSubjId))
      );
      if (parentSubj && !(filteredSubjects || []).some((s) => s && s.id === parentSubj.id)) {
        return false;
      }
    }

    return true;
  });

  const visibleCategoryIds = new Set((filteredCategories || []).map((c) => c?.id).filter(Boolean));

  // 3. FILTER MATERIALS:
  const filteredMaterials = safeMaterials.filter((mat) => {
    if (!mat) return false;
    // Parent category check
    if (!visibleCategoryIds.has(mat.categoryId)) {
      return false;
    }

    // Check targetGrade against student's class
    const parentCat = safeCategories.find((c) => c && c.id === mat.categoryId);
    const matGradeClean = String(mat.targetGrade || '').trim().toLowerCase();
    const isMatSpecificGrade =
      mat.targetGrade &&
      matGradeClean !== 'all' &&
      matGradeClean !== 'umum' &&
      matGradeClean !== 'semua' &&
      matGradeClean !== '*' &&
      matGradeClean !== 'adaptif' &&
      matGradeClean !== '';

    // Effective grade: material's own grade or inherited from parent category
    const effectiveMatGrade = isMatSpecificGrade ? mat.targetGrade : parentCat?.targetGrade;
    const effectiveClean = String(effectiveMatGrade || '').trim().toLowerCase();
    const isEffectiveSpecific =
      effectiveMatGrade &&
      effectiveClean !== 'all' &&
      effectiveClean !== 'umum' &&
      effectiveClean !== 'semua' &&
      effectiveClean !== '*' &&
      effectiveClean !== 'adaptif' &&
      effectiveClean !== '';

    if (isEffectiveSpecific && !isGradeMatchStudent(effectiveMatGrade, studentClass)) {
      return false;
    }

    // Creator check with targetGrade awareness
    if (mat.createdBy && !isCreatorAllowedForStudent(mat.createdBy, effectiveMatGrade)) {
      return false;
    }

    return true;
  });

  // 4. POST-FILTER: Clean up categories that had materials but none matching student's grade
  const remainingCategoryIdsWithMats = new Set((filteredMaterials || []).map((m) => m?.categoryId).filter(Boolean));
  const finalCategories = (filteredCategories || []).filter((cat) => {
    if (!cat) return false;
    const originalCatMats = safeMaterials.filter((m) => m && m.categoryId === cat.id && m.isPublished !== false);
    if (originalCatMats.length === 0) return true; // Keep newly created/empty topic or when materials not yet loaded

    // If category itself specifies an explicit targetGrade that matches student's grade, keep it!
    const catGradeClean = String(cat.targetGrade || '').trim().toLowerCase();
    const isCatSpecific =
      cat.targetGrade &&
      catGradeClean !== 'all' &&
      catGradeClean !== 'umum' &&
      catGradeClean !== 'semua' &&
      catGradeClean !== '*' &&
      catGradeClean !== 'adaptif' &&
      catGradeClean !== '';
    if (isCatSpecific && isGradeMatchStudent(cat.targetGrade, studentClass)) {
      return true;
    }

    return remainingCategoryIdsWithMats.has(cat.id);
  });

  const finalCatSubjIds = new Set(
    (finalCategories || []).map((c) => (c?.subjectId || 'informatika').toLowerCase().trim())
  );
  const finalSubjects = (filteredSubjects || []).filter((subj) => {
    if (!subj) return false;
    const subjIdClean = (subj.id || '').toLowerCase().trim();
    const originalSubjCats = safeCategories.filter(
      (c) => c && (c.subjectId || 'informatika').toLowerCase().trim() === subjIdClean && c.isPublished !== false
    );
    if (originalSubjCats.length === 0) return true;
    return finalCatSubjIds.has(subjIdClean);
  });

  return {
    filteredSubjects: finalSubjects,
    filteredCategories: finalCategories,
    filteredMaterials,
  };
}

