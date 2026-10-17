import React, { useRef, useEffect, useState } from 'react';
import {
  Layers,
  FileSpreadsheet,
  BarChart3,
  Link as LinkIcon,
  GraduationCap,
  Users,
  Lock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  ClipboardList,
  Bomb,
} from 'lucide-react';

export type AdminTabType =
  | 'subjects'
  | 'categories'
  | 'materials'
  | 'bank_soal'
  | 'icebreaking'
  | 'gform_results'
  | 'progress'
  | 'tester'
  | 'settings'
  | 'students'
  | 'teachers';

export interface AdminTabCounts {
  categories?: number;
  materials?: number;
  bankSoal?: number;
  gformResults?: number;
  progress?: number;
  subjects?: number;
  students?: number;
  teachers?: number;
}

interface AdminSidebarProps {
  activeTab: AdminTabType;
  onSelectTab: (tab: AdminTabType) => void;
  isTeacherRole?: boolean;
  counts?: AdminTabCounts;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  isTeacherRole = false,
  counts = {} as AdminTabCounts,
}) => {
  const navTabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);
  const isDraggingRef = useRef(false);

  const checkScroll = () => {
    if (navTabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navTabsRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [activeTab, isTeacherRole]);

  // Auto-scroll active tab into view smoothly
  useEffect(() => {
    if (navTabsRef.current) {
      const activeEl = navTabsRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeTab]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!navTabsRef.current) return;
    setIsMouseDown(true);
    isDraggingRef.current = false;
    setStartX(e.pageX - navTabsRef.current.offsetLeft);
    setScrollLeftStart(navTabsRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !navTabsRef.current) return;
    e.preventDefault();
    const x = e.pageX - navTabsRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      isDraggingRef.current = true;
    }
    navTabsRef.current.scrollLeft = scrollLeftStart - walk;
    checkScroll();
  };

  const handleMouseUpOrLeave = () => {
    setIsMouseDown(false);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 60);
  };

  const scrollDirection = (direction: 'left' | 'right') => {
    if (navTabsRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      navTabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScroll, 300);
    }
  };

  const tabs: Array<{
    id: AdminTabType;
    label: string;
    icon: React.ReactNode;
    color: string;
    count?: number;
    hideForTeacher?: boolean;
  }> = [
    {
      id: 'subjects',
      label: 'Mata Pelajaran',
      icon: <BookOpen className="w-4 h-4" />,
      color: 'text-indigo-600',
      count: counts.subjects,
      hideForTeacher: true,
    },
    {
      id: 'categories',
      label: 'Bab & Topik',
      icon: <Layers className="w-4 h-4" />,
      color: 'text-violet-600',
      count: counts.categories,
    },
    {
      id: 'materials',
      label: 'Bahan Ajar',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      color: 'text-emerald-600',
      count: counts.materials,
    },
    {
      id: 'bank_soal',
      label: 'Bank Soal Mini Kuis AI',
      icon: <Sparkles className="w-4 h-4" />,
      color: 'text-amber-600',
      count: counts.bankSoal,
    },
    {
      id: 'icebreaking',
      label: 'Icebreaking Game',
      icon: <Bomb className="w-4 h-4" />,
      color: 'text-rose-600',
    },
    {
      id: 'gform_results',
      label: 'Hasil Ujian / G-Form',
      icon: <ClipboardList className="w-4 h-4" />,
      color: 'text-purple-600',
    },
    {
      id: 'progress',
      label: 'Progres Siswa',
      icon: <BarChart3 className="w-4 h-4" />,
      color: 'text-blue-600',
    },
    {
      id: 'students',
      label: 'Siswa & Kelas',
      icon: <GraduationCap className="w-4 h-4" />,
      color: 'text-fuchsia-600',
      count: counts.students,
      hideForTeacher: true,
    },
    {
      id: 'teachers',
      label: 'Guru Pengampu',
      icon: <Users className="w-4 h-4" />,
      color: 'text-cyan-600',
      count: counts.teachers,
      hideForTeacher: true,
    },
    {
      id: 'tester',
      label: 'Uji Coba Tautan',
      icon: <LinkIcon className="w-4 h-4" />,
      color: 'text-sky-600',
    },
    {
      id: 'settings',
      label: 'Sistem & Backup',
      icon: <Lock className="w-4 h-4" />,
      color: 'text-slate-600',
      hideForTeacher: true,
    },
  ];

  const visibleTabs = tabs.filter((t) => !(t.hideForTeacher && isTeacherRole));

  return (
    <div className="w-full border-t border-slate-200 bg-slate-50 py-2 sm:py-2.5">
      <div className="relative max-w-[1480px] mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Scroll indicator Left */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollDirection('left')}
            className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-lg shadow-slate-300/60 flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-all cursor-pointer"
            aria-label="Scroll Kiri"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}

        {/* Tabs Container - Elevated Navbar Dock */}
        <div
          ref={navTabsRef}
          role="navigation"
          aria-label="Menu Navigasi Admin & Guru"
          onScroll={checkScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-white rounded-2xl overflow-x-auto no-scrollbar scroll-smooth select-none cursor-grab active:cursor-grabbing border border-slate-200 shadow-md shadow-slate-200/80 ring-1 ring-slate-900/5 transition-all"
        >
          {(visibleTabs || []).map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => {
                  if (!isDraggingRef.current) {
                    onSelectTab(tab.id);
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 font-extrabold border border-indigo-500 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-transparent'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.icon}
                </div>
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scroll indicator Right */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollDirection('right')}
            className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-lg shadow-slate-300/60 flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-all cursor-pointer"
            aria-label="Scroll Kanan"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
};
