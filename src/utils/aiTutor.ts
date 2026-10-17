// Client-side cache to eliminate redundant network calls for identical questions
const tutorClientCache = new Map<string, { analogy?: string; hint?: string }>();

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { auth } = await import('../lib/firebase');
    let user = auth.currentUser;
    if (!user) {
      const { signInAnonymously } = await import('firebase/auth');
      const cred = await signInAnonymously(auth).catch(() => null);
      user = cred?.user || auth.currentUser;
    }
    if (user) {
      const token = await user.getIdToken().catch(() => null);
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch {}
  return {};
}

export async function fetchAIAnalogy(questionText: string, options: string[], title?: string): Promise<string> {
  const cleanQ = (questionText || '').trim();
  const cacheKey = cleanQ.toLowerCase().slice(0, 100);

  const cached = tutorClientCache.get(cacheKey);
  if (cached?.analogy) {
    return cached.analogy;
  }

  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch('/api/ai-analogy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        questionText: cleanQ,
        options,
        title,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.analogy) {
        const existing = tutorClientCache.get(cacheKey) || {};
        tutorClientCache.set(cacheKey, { ...existing, analogy: data.analogy, hint: data.hint || existing.hint });
        return data.analogy;
      }
    }
  } catch (err) {
    console.warn('AI Analogy fetch failed, falling back to local heuristic:', err);
  }

  const fallback = `Bayangkan konsep "${(title || cleanQ).slice(0, 45)}..." seperti situasi di kehidupan nyata: di mana setiap elemen memiliki peran spesifik untuk mencapai tujuan bersama secara efisien!`;
  return fallback;
}

export async function fetchAIHint(questionText: string, options: string[], title?: string): Promise<string> {
  const cleanQ = (questionText || '').trim();
  const cacheKey = cleanQ.toLowerCase().slice(0, 100);

  const cached = tutorClientCache.get(cacheKey);
  if (cached?.hint) {
    return cached.hint.startsWith('💡') ? cached.hint : `💡 **Petunjuk AI**: ${cached.hint}`;
  }

  try {
    const authHeaders = await getAuthHeader();
    const response = await fetch('/api/ai-analogy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        questionText: cleanQ,
        options,
        title,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.hint) {
        const formatted = `💡 **Petunjuk AI**: ${data.hint}`;
        const existing = tutorClientCache.get(cacheKey) || {};
        tutorClientCache.set(cacheKey, { ...existing, hint: formatted, analogy: data.analogy || existing.analogy });
        return formatted;
      }
    }
  } catch (err) {
    console.warn('AI Hint fetch failed, falling back:', err);
  }

  return `💡 **Petunjuk AI**: Fokus pada kata kunci utama dalam pertanyaan. Eliminasi pilihan yang bertentangan dengan prinsip dasar materi ini dan perhatikan keterkaitannya secara logis!`;
}

let isSpeechSpeaking = false;

export function speakText(text: string, onEnd?: () => void): boolean {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return false;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Strip Markdown markers like **, *, _, #
  const cleanText = text.replace(/[*_#~`]/g, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'id-ID';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Try to find an Indonesian voice if available
  const voices = window.speechSynthesis.getVoices();
  const idVoice = voices.find((v) => v.lang.includes('id') || v.lang.includes('ID'));
  if (idVoice) {
    utterance.voice = idVoice;
  }

  utterance.onend = () => {
    isSpeechSpeaking = false;
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    isSpeechSpeaking = false;
    if (onEnd) onEnd();
  };

  isSpeechSpeaking = true;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    isSpeechSpeaking = false;
  }
}

export function isSpeaking(): boolean {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking;
}
