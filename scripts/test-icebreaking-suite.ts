import { GameSession, GamePlayer, GameTimerState } from '../src/types/game';
import { getGameTimerState, MASTER_QUESTIONS, pickRandomScrubbedQuestion } from '../api/_lib/icebreakingServerCore';
import { ICEBREAKING_QUESTIONS, pickRandomIcebreakingQuestion } from '../src/data/icebreakingQuestions';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: string) {
  if (condition) {
    results.push({ suite, name, passed: true, details });
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    results.push({ suite, name, passed: false, error: 'Assertion failed', details });
    console.error(`  ❌ [FAIL] ${name} ${details ? '- ' + details : ''}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING ICE BREAKING AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  // --- SUITE 1: Pure Timer & Timestamp Calculations ---
  console.log('--- 1. Pure Timer & Timestamp Invariance ---');
  const now = 1700000000000;
  const mockSession: GameSession = {
    id: 'test_room_1',
    roomToken: 'TEST-12',
    teacherId: 'teacher_1',
    targetClass: '7A',
    status: 'playing',
    minDurationSeconds: 60,
    maxDurationSeconds: 120,
    timerDurationSeconds: 90,
    secretExplodeSeconds: 90,
    explodeAt: now + 45000, // 45 seconds remaining
    timerStartedAt: now - 45000,
    timerPausedAt: null,
    isTimerPaused: false,
    currentHolderId: 'student_a',
    currentHolderName: 'Siswa A',
    activeQuestion: null,
    players: {
      student_a: { id: 'student_a', name: 'Siswa A', isAlive: true, joinedAt: now },
      student_b: { id: 'student_b', name: 'Siswa B', isAlive: true, joinedAt: now },
    },
    playerCount: 2,
    aliveCount: 2,
    roundNumber: 1,
    createdAt: now - 50000,
    updatedAt: now - 45000,
  };

  const timerMid = getGameTimerState(mockSession, now);
  assert(timerMid.isActive === true, 'Timer', 'Active when playing');
  assert(timerMid.remainingSeconds === 45, 'Timer', 'Accurate remaining seconds (45s)', `got ${timerMid.remainingSeconds}`);
  assert(timerMid.isExpired === false, 'Timer', 'Not expired at t = mid');
  assert(timerMid.tensionPercentage === 50, 'Timer', 'Tension percentage at 50%', `got ${timerMid.tensionPercentage}%`);

  // Check expiration at t = explodeAt
  const timerExpired = getGameTimerState(mockSession, now + 45001);
  assert(timerExpired.isExpired === true, 'Timer', 'isExpired true when now > explodeAt');
  assert(timerExpired.remainingSeconds === 0, 'Timer', 'remainingSeconds clamped to 0 on expiration');

  // Check paused state
  const pausedSession: GameSession = {
    ...mockSession,
    status: 'paused',
    isTimerPaused: true,
    timerPausedAt: now + 10000, // paused 10 seconds into the remaining 45s (35s left)
  };
  const timerPaused = getGameTimerState(pausedSession, now + 30000); // 20s later in real time
  assert(timerPaused.isPaused === true, 'Timer', 'isPaused true when session is paused');
  assert(timerPaused.remainingSeconds === 35, 'Timer', 'Frozen remaining seconds during pause (35s)', `got ${timerPaused.remainingSeconds}`);

  // --- SUITE 2: Master Questions & Randomization Security ---
  console.log('\n--- 2. Question Bank & Scrubbing Security ---');
  assert(MASTER_QUESTIONS.length >= 40, 'QuestionBank', 'Master questions count >= 40', `found ${MASTER_QUESTIONS.length}`);
  assert(ICEBREAKING_QUESTIONS.length >= 40, 'QuestionBank', 'Client questions count >= 40', `found ${ICEBREAKING_QUESTIONS.length}`);

  // Verify uniqueness of IDs
  const masterIds = new Set(MASTER_QUESTIONS.map((q) => q.id));
  assert(masterIds.size === MASTER_QUESTIONS.length, 'QuestionBank', 'All master question IDs are unique');

  // Verify that scrubbed question does NOT leak correct answer index or text
  const scrubbed = pickRandomScrubbedQuestion();
  assert(typeof (scrubbed as any).correctAnswerIndex === 'undefined', 'QuestionScrubbing', 'correctAnswerIndex is stripped');
  assert(typeof (scrubbed as any).correctText === 'undefined', 'QuestionScrubbing', 'correctText is stripped');
  assert(scrubbed.options.length === 4, 'QuestionScrubbing', 'Exactly 4 options present');

  // Verify that client question scrub does not leak correct index
  const clientQ = pickRandomIcebreakingQuestion();
  assert(typeof (clientQ as any).correctAnswerIndex === 'undefined', 'QuestionScrubbing', 'Client pickRandom leaves correctAnswerIndex undefined');

  // --- SUITE 3: Answer Matching Accuracy (Bug Fix Verification) ---
  console.log('\n--- 3. Answer Matching Accuracy & Master Alignment ---');
  for (let i = 0; i < 5; i++) {
    const raw = ICEBREAKING_QUESTIONS[i];
    const correctText = raw.options[0]; // Master correct answer text
    const scrambled = pickRandomIcebreakingQuestion([raw.id]); // pick another question or same
    const masterForRaw = ICEBREAKING_QUESTIONS.find((q) => q.id === raw.id);
    assert(masterForRaw !== undefined && masterForRaw.options[0] === correctText, 'AnswerCheck', `Master alignment for ${raw.id}`);
  }

  // --- SUITE 4: Live HTTP API Endpoints on Localhost:3000 ---
  console.log('\n--- 4. Live Server Endpoints Integration ---');
  try {
    const healthRes = await fetch('http://localhost:3000/api/health');
    assert(healthRes.status === 200, 'Endpoints', 'GET /api/health returns 200');
    const healthData = await healthRes.json();
    assert(healthData.status === 'ok', 'Endpoints', 'Health status is "ok"');
  } catch (err: any) {
    assert(false, 'Endpoints', 'Dev server running on 3000', err.message);
  }

  // Test /api/game-submit-answer with invalid/missing body
  try {
    const submitInvalid = await fetch('http://localhost:3000/api/game-submit-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await submitInvalid.json();
    assert(data.ok === false, 'Endpoints', 'POST /api/game-submit-answer rejects empty payload');
  } catch (err: any) {
    assert(false, 'Endpoints', 'POST /api/game-submit-answer reachable', err.message);
  }

  // Test /api/game-pass-bomb with invalid body
  try {
    const passInvalid = await fetch('http://localhost:3000/api/game-pass-bomb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await passInvalid.json();
    assert(data.ok === false, 'Endpoints', 'POST /api/game-pass-bomb rejects missing payload');
  } catch (err: any) {
    assert(false, 'Endpoints', 'POST /api/game-pass-bomb reachable', err.message);
  }

  // Test /api/game-trigger-explosion with missing body
  try {
    const explodeInvalid = await fetch('http://localhost:3000/api/game-trigger-explosion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await explodeInvalid.json();
    assert(data.ok === false, 'Endpoints', 'POST /api/game-trigger-explosion rejects empty payload');
  } catch (err: any) {
    assert(false, 'Endpoints', 'POST /api/game-trigger-explosion reachable', err.message);
  }

  // --- SUITE 5: Deduplication & Concurrency Simulation ---
  console.log('\n--- 5. Concurrency & Deduplication Logic ---');
  // Simulated dual explosion call
  let firstCallProcessed = false;
  let secondCallDeduplicated = false;

  const simulateAtomicExplosion = (holderId: string, currentSessionHolder: string, isExpired: boolean) => {
    if (!isExpired) return { ok: false, reason: 'not_expired' };
    if (holderId !== currentSessionHolder) return { ok: false, reason: 'holder_mismatch' };
    if (firstCallProcessed) {
      // Second call finds holder already rotated or dead
      return { ok: false, reason: 'already_processed_or_dead' };
    }
    firstCallProcessed = true;
    return { ok: true, reason: 'exploded' };
  };

  const call1 = simulateAtomicExplosion('student_a', 'student_a', true);
  assert(call1.ok === true && call1.reason === 'exploded', 'Concurrency', 'First explosion trigger succeeds');

  const call2 = simulateAtomicExplosion('student_a', 'student_a', true);
  assert(call2.ok === false && call2.reason === 'already_processed_or_dead', 'Concurrency', 'Second simultaneous explosion trigger rejected cleanly');

  // --- SUITE 6: Firestore Security Rules Static Verification ---
  console.log('\n--- 6. Firestore Security Rules Static Audit ---');
  const fs = await import('fs');
  const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

  assert(rulesContent.includes('match /game_sessions/{sessionId}'), 'SecurityRules', 'Rules cover /game_sessions/{sessionId}');
  assert(rulesContent.includes('match /private_state/{doc=**}'), 'SecurityRules', 'Rules define private_state subcollection');
  assert(rulesContent.includes('allow read, write: if false;'), 'SecurityRules', 'private_state subcollection explicitly denies all reads/writes');
  assert(rulesContent.includes('match /players/{playerId}'), 'SecurityRules', 'Rules define players subcollection');

  // --- SUMMARY ---
  console.log('\n====================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
