import os

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()

cut_idx = -1
for i in range(9440, min(len(lines), 9480)):
    if 'Order & Published Toggle' in lines[i] or 'Urutan Tampil' in lines[i]:
        cut_idx = i
        break

print(f"Cutting at line index: {cut_idx}")

clean_head = ''.join(lines[:cut_idx])

clean_tail = """                  {/* Order & Target Grade */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Urutan Tampil (1, 2, dst)
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder={`Otomatis (${materials.filter((m) => m.categoryId === matCategoryId).reduce((max, m) => Math.max(max, m.order || 0), 0) + 1})`}
                        value={matOrder}
                        onChange={(e) => setMatOrder(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Target Jenjang Kelas
                      </label>
                      <select
                        value={matTargetGrade}
                        onChange={(e) => setMatTargetGrade(e.target.value)}
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="smp-7">Kelas VII (SMP)</option>
                        <option value="smp-8">Kelas VIII (SMP)</option>
                        <option value="smp-9">Kelas IX (SMP)</option>
                        <option value="umum">Semua Kelas / Umum</option>
                      </select>
                    </div>
                  </div>

                  {/* Prerequisite / Lock Material Toggle */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Kunci Materi (Prasyarat Bertingkat)</span>
                          <span className="text-[10px] text-slate-500 block">Siswa wajib menyelesaikan materi sebelumnya sebelum membuka materi ini.</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={matRequirePreviousCompleted}
                        onChange={(e) => setMatRequirePreviousCompleted(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Publish Status Switch */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center gap-2">
                      {matIsPublished ? <Eye className="w-4 h-4 text-emerald-600 shrink-0" /> : <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />}
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Status Publikasi</span>
                        <span className="text-[10px] text-slate-500 block">Jika aktif, materi ini langsung dapat diakses oleh siswa.</span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={matIsPublished}
                        onChange={(e) => setMatIsPublished(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: QUIZ & REFLECTION */}
              {matModalTab === 'quiz' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Pertanyaan Refleksi &amp; Pemahaman Mandiri</span>
                    </div>
                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                      Tambahkan daftar pertanyaan refleksi atau rangkuman mandiri untuk dikerjakan siswa setelah mempelajari bahan ajar ini. Masukkan <strong>1 pertanyaan per baris</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Daftar Pertanyaan Refleksi (Opsional)
                    </label>
                    <textarea
                      rows={5}
                      placeholder={`Contoh:\n1. Apa konsep utama yang Anda pelajari dari materi ini?\n2. Bagaimana cara menerapkan materi ini dalam pemecahan masalah sehari-hari?\n3. Bagian mana yang menurut Anda masih paling menantang?`}
                      value={matReflectionQuestions}
                      onChange={(e) => setMatReflectionQuestions(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Setiap baris teks baru akan otomatis dikonversi menjadi 1 pertanyaan refleksi interaktif bagi siswa.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: GAMIFICATION & INTERACTIVE */}
              {matModalTab === 'gamification' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-gradient-to-br from-amber-50 via-white to-indigo-50 border border-amber-200 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 text-amber-950 font-extrabold text-xs">
                      <Trophy className="w-4 h-4 text-amber-600" />
                      <span>Konfigurasi Gamifikasi &amp; Interaktivitas Pembelajaran</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Sesuaikan fitur reward XP, batasan waktu pengerjaan tantangan, dan asistensi AI Tutor untuk meningkatkan engagement siswa.
                    </p>
                  </div>

                  {/* Enable Gamification Toggle */}
                  <label className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Sistem Gamifikasi &amp; Poin XP</span>
                        <span className="text-[10px] text-slate-500 block">Berikan reward XP, koin, dan kenaikan level saat siswa menuntaskan materi ini.</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={matEnableGamification}
                      onChange={(e) => setMatEnableGamification(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  {/* AI Tutor Assistant Toggle */}
                  <label className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Asistensi AI Tutor Interaktif</span>
                        <span className="text-[10px] text-slate-500 block">Siswa dapat berkonsultasi dan bertanya konsep materi langsung ke AI Tutor cerdas.</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={matEnableAITutor}
                      onChange={(e) => setMatEnableAITutor(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  {/* Lifelines Assistance Toggle */}
                  <label className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Bantuan Lifeline (50:50 &amp; Hint)</span>
                        <span className="text-[10px] text-slate-500 block">Mengizinkan penggunaan bantuan saat pengerjaan kuis materi.</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={matEnableLifelines}
                      onChange={(e) => setMatEnableLifelines(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  {/* Time Attack Challenge Toggle */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Mode Tantangan Waktu (Time Attack)</span>
                          <span className="text-[10px] text-slate-500 block">Aktifkan batas waktu detik per soal untuk menguji kecepatan kuis siswa.</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={matEnableTimeAttack}
                        onChange={(e) => setMatEnableTimeAttack(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </label>

                    {matEnableTimeAttack && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3 animate-fadeIn">
                        <label className="text-xs font-bold text-slate-700">
                          Batas Waktu per Soal (Detik):
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={300}
                          value={matTimeAttackSeconds}
                          onChange={(e) => setMatTimeAttackSeconds(parseInt(e.target.value, 10) || 30)}
                          className="w-24 py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-3.5 sm:py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsMaterialModalOpen(false);
                  resetMaterialForm();
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : editingMaterial ? 'Simpan Perubahan' : 'Tambah Materi Baru'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </main>
</div>
);
};

export default AdminDashboard;
"""

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(clean_head + clean_tail)

print("Replacement complete!")
