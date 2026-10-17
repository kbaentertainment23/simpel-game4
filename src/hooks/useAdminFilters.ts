import { useState, useCallback } from 'react';
import { Subject, Category } from '../types';

export function useAdminFilters(subjects: Subject[] = [], categories: Category[] = []) {
  // Navigation & Search Queries
  const [subjSearchQuery, setSubjSearchQuery] = useState('');
  const [subjSortBy, setSubjSortBy] = useState<'order' | 'name' | 'topics'>('order');

  const [catSearchQuery, setCatSearchQuery] = useState('');
  const [catPrereqFilter, setCatPrereqFilter] = useState<string>('all');
  const [catPublishFilter, setCatPublishFilter] = useState<string>('all');
  const [categorySubjectFilter, setCategorySubjectFilter] = useState<string>('all');
  const [catGradeFilter, setCatGradeFilter] = useState<string>('all');

  const [matSearchQuery, setMatSearchQuery] = useState('');
  const [matTypeFilter, setMatTypeFilter] = useState<string>('all');
  const [matGradeFilter, setMatGradeFilter] = useState<string>('all');
  const [selectedSubjIdFilter, setSelectedSubjIdFilter] = useState<string>('all');
  const [selectedCatIdFilter, setSelectedCatIdFilter] = useState<string>('all');

  // Student & Teacher Filters
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentGradeFilter, setStudentGradeFilter] = useState<string>('all');
  const [studentSubClassFilter, setStudentSubClassFilter] = useState<string>('all');
  const [studentSortBy, setStudentSortBy] = useState<'absen' | 'nama' | 'nisn'>('absen');

  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState<string>('all');

  // Accordion Grouping States
  const [collapsedCatSubjects, setCollapsedCatSubjects] = useState<Record<string, boolean>>({});
  const [collapsedMatSubjects, setCollapsedMatSubjects] = useState<Record<string, boolean>>({});
  const [collapsedMatCategories, setCollapsedMatCategories] = useState<Record<string, boolean>>({});

  const toggleCatSubject = useCallback((subjId: string) => {
    setCollapsedCatSubjects((prev) => ({ ...prev, [subjId]: !(prev[subjId] ?? true) }));
  }, []);

  const toggleMatSubject = useCallback((subjId: string) => {
    setCollapsedMatSubjects((prev) => ({ ...prev, [subjId]: !(prev[subjId] ?? false) }));
  }, []);

  const toggleMatCategory = useCallback((catId: string) => {
    setCollapsedMatCategories((prev) => {
      const isCurrentlyCollapsed = prev[catId] !== false;
      return { ...prev, [catId]: !isCurrentlyCollapsed };
    });
  }, []);

  const expandAllCatGroups = useCallback(() => {
    const nextSubj: Record<string, boolean> = {};
    (subjects || []).forEach((s) => {
      if (s?.id) nextSubj[s.id] = false;
    });
    setCollapsedCatSubjects(nextSubj);
  }, [subjects]);

  const collapseAllCatGroups = useCallback(() => {
    const nextSubj: Record<string, boolean> = {};
    (subjects || []).forEach((s) => {
      if (s?.id) nextSubj[s.id] = true;
    });
    setCollapsedCatSubjects(nextSubj);
  }, [subjects]);

  const expandAllMatGroups = useCallback(() => {
    const nextSubj: Record<string, boolean> = {};
    (subjects || []).forEach((s) => {
      if (s?.id) nextSubj[s.id] = false;
    });
    const nextCat: Record<string, boolean> = {};
    (categories || []).forEach((c) => {
      if (c?.id) nextCat[c.id] = false;
    });
    setCollapsedMatSubjects(nextSubj);
    setCollapsedMatCategories(nextCat);
  }, [subjects, categories]);

  const collapseAllMatGroups = useCallback(() => {
    const nextSubj: Record<string, boolean> = {};
    (subjects || []).forEach((s) => {
      if (s?.id) nextSubj[s.id] = true;
    });
    const nextCat: Record<string, boolean> = {};
    (categories || []).forEach((c) => {
      if (c?.id) nextCat[c.id] = true;
    });
    setCollapsedMatSubjects(nextSubj);
    setCollapsedMatCategories(nextCat);
  }, [subjects, categories]);

  return {
    // Subject filters
    subjSearchQuery,
    setSubjSearchQuery,
    subjSortBy,
    setSubjSortBy,

    // Category filters
    catSearchQuery,
    setCatSearchQuery,
    catPrereqFilter,
    setCatPrereqFilter,
    catPublishFilter,
    setCatPublishFilter,
    categorySubjectFilter,
    setCategorySubjectFilter,
    catGradeFilter,
    setCatGradeFilter,

    // Material filters
    matSearchQuery,
    setMatSearchQuery,
    matTypeFilter,
    setMatTypeFilter,
    matGradeFilter,
    setMatGradeFilter,
    selectedSubjIdFilter,
    setSelectedSubjIdFilter,
    selectedCatIdFilter,
    setSelectedCatIdFilter,

    // Student & Teacher filters
    studentSearchQuery,
    setStudentSearchQuery,
    studentGradeFilter,
    setStudentGradeFilter,
    studentSubClassFilter,
    setStudentSubClassFilter,
    studentSortBy,
    setStudentSortBy,
    teacherSearchQuery,
    setTeacherSearchQuery,
    teacherSubjectFilter,
    setTeacherSubjectFilter,

    // Accordions
    collapsedCatSubjects,
    collapsedMatSubjects,
    collapsedMatCategories,
    toggleCatSubject,
    toggleMatSubject,
    toggleMatCategory,
    expandAllCatGroups,
    collapseAllCatGroups,
    expandAllMatGroups,
    collapseAllMatGroups,
  };
}
