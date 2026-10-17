import React, { useState } from 'react';
import { Search, Check, ChevronDown, Sparkles } from 'lucide-react';
import { SUBJECT_ICON_LIST, ICON_CATEGORIES, getSubjectIcon } from '../utils/subjectIcons';

interface IconPickerProps {
  value?: string;
  onChange?: (iconKey: string) => void;
  selectedIcon?: string;
  onSelectIcon?: (iconKey: string) => void;
  label?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  selectedIcon,
  onSelectIcon,
  label = 'Ikon Display Mata Pelajaran',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  const effectiveValue = value ?? selectedIcon ?? '';

  const selectedIconObj = SUBJECT_ICON_LIST.find(
    (item) => item.key.toLowerCase() === effectiveValue.toLowerCase()
  ) || SUBJECT_ICON_LIST[0];

  const handleSelectIcon = (key: string) => {
    if (typeof onChange === 'function') {
      onChange(key);
    }
    if (typeof onSelectIcon === 'function') {
      onSelectIcon(key);
    }
    setIsOpen(false);
  };

  const filteredIcons = SUBJECT_ICON_LIST.filter((item) => {
    const matchesCat = selectedCategory === 'Semua' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.label.toLowerCase().includes(q) ||
      item.key.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-700">{label}</label>

      {/* Selected Icon Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 transition-all cursor-pointer flex items-center justify-between shadow-2xs group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            {getSubjectIcon(effectiveValue, 'w-4 h-4')}
          </div>
          <div className="text-left">
            <div className="font-bold text-xs text-slate-800 line-clamp-1">
              {selectedIconObj.label}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {selectedIconObj.key} • {selectedIconObj.category}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
          <span>{isOpen ? 'Tutup Pilihan' : 'Pilih Ikon'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Grid Picker */}
      {isOpen && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-md animate-in fade-in zoom-in-95 duration-150">
          
          {/* Search & Header */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari ikon (misal: Agama Hindu, Fisika, Matematika, Kimia, Agama, TIK, Seni)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {(ICON_CATEGORIES || []).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Icon Grid */}
          {(filteredIcons || []).length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Tidak ada ikon yang cocok dengan kata kunci "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {(filteredIcons || []).map((item) => {
                const isSelected = effectiveValue.toLowerCase() === item.key.toLowerCase();
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectIcon(item.key)}
                    className={`p-2 rounded-xl text-left border transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white hover:bg-indigo-50/60 border-slate-200 text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[11px] truncate leading-snug">
                        {item.label}
                      </div>
                      <div
                        className={`text-[9px] truncate ${
                          isSelected ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {item.key}
                      </div>
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Sesuai Kurikulum Indonesia</span>
            </span>
            <span>Menampilkan {filteredIcons.length} ikon</span>
          </div>

        </div>
      )}
    </div>
  );
};
