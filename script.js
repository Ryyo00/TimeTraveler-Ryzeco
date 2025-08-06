// --- DATA GAME (V2) ---
const gameData = [
    {
        level: 1,
        title: "Zaman Hindu-Buddha",
        minScore: 20,
        theme: "Kerajaan Sriwijaya dan Majapahit di Indonesia",
        challengeType: 'quiz'
    },
    {
        level: 2,
        title: "Zaman Kerajaan Islam",
        minScore: 50,
        theme: "Kerajaan Islam di Nusantara", // Ditambahkan untuk fallback
        challengeType: 'quiz'
    },
    {
        level: 3,
        title: "Zaman Kolonialisme",
        minScore: 80,
        theme: "Kolonialisme dan Perlawanan", // Ditambahkan untuk fallback
        challengeType: 'quiz'
    },
    {
        level: 4,
        title: "Pergerakan Nasional",
        minScore: 110,
        theme: "Pergerakan Nasional Indonesia", // Ditambahkan untuk fallback
        challengeType: 'quiz'
    },
    {
        level: 5,
        title: "Proklamasi Kemerdekaan",
        minScore: 130,
        theme: "Tokoh dan peristiwa sekitar proklamasi kemerdekaan Indonesia 1945",
        challengeType: 'quiz'
    }
];

// --- ELEMEN DOM ---
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const musicToggleBtn = document.getElementById('music-toggle');
const bgMusic = document.getElementById('bg-music');

const levelTitleEl = document.getElementById('level-title');
const scoreEl = document.getElementById('score');
const levelContentEl = document.getElementById('level-content');
const levelFeedbackEl = document.getElementById('level-feedback');
const finalScoreEl = document.getElementById('final-score');
const progressBarFill = document.getElementById('progress-bar-fill'); // FITUR BARU

// --- STATE GAME ---
let currentLevelIndex = 0;
let score = 0;
let currentQuestionIndex = 0;
let isMusicPlaying = false;
let levelQuestions = []; 
let hintUsedThisLevel = false; // FITUR BARU

// --- EFEK SUARA (FITUR BARU) ---
let soundsReady = false;
let correctSound, incorrectSound, clickSound;

// Inisialisasi Tone.js setelah interaksi pengguna
function setupSounds() {
    if (soundsReady) return;
    correctSound = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 } }).toDestination();
    incorrectSound = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.2 } }).toDestination();
    clickSound = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination();
    soundsReady = true;
}

// --- FUNGSI API & FALLBACK ---
async function getQuizQuestions(theme) {
    levelContentEl.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full">
            <div class="loader"></div>
            <p class="mt-4 text-lg text-cyan-300">Menyiapkan mesin waktu dan pertanyaan...</p>
        </div>`;
        
    const apiKey = ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [{
          text: `Buatkan 4 soal pilihan ganda (4 opsi) tentang sejarah Indonesia dengan tema "${theme}". Berikan jawaban yang benar dan penjelasan singkat untuk setiap soal. Format respons harus berupa JSON.`,
        }],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            questions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  question: { type: "STRING" },
                  options: { type: "ARRAY", items: { type: "STRING" } },
                  answer: { type: "STRING" },
                  explanation: { type: "STRING" }
                },
                required: ["question", "options", "answer", "explanation"]
              }
            }
          }
        }
      }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const result = await response.json();
        const jsonText = result.candidates[0].content.parts[0].text;
        const data = JSON.parse(jsonText);
        if (data.questions && data.questions.length > 0) return data.questions;
        throw new Error("Format data JSON dari API tidak valid.");
    } catch (error) {
        console.error("Gagal mengambil soal dari API, menggunakan soal dari JSON:", error);
        levelContentEl.innerHTML = `<div class="text-center text-yellow-400 p-4 card">
            <p>Gagal terhubung ke mesin waktu AI. Mengalihkan ke arsip darurat...</p>
        </div>`;
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        
        try {
            const response = await fetch('questions.json');
            if (!response.ok) throw new Error("File JSON tidak ditemukan.");
            const staticData = await response.json();
            const allQuestions = staticData[theme]?.questions || [];
            // FITUR BARU: Acak soal dari JSON
            return allQuestions.sort(() => 0.5 - Math.random()).slice(0, 4);
        } catch (jsonError) {
            console.error("Gagal memuat file JSON:", jsonError);
            return [];
        }
    }
}

// --- FUNGSI GAME ---

function startGame() {
    if (soundsReady) clickSound.triggerAttackRelease("C2", "8n");
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    gameScreen.classList.add('screen');
    endScreen.classList.add('hidden');
    currentLevelIndex = 0;
    score = 0;
    updateScoreDisplay();
    loadLevel(currentLevelIndex);
}

async function loadLevel(levelIndex) {
    if (levelIndex >= gameData.length) {
        showEndScreen();
        return;
    }

    const level = gameData[levelIndex];
    levelTitleEl.textContent = level.title;
    levelFeedbackEl.innerHTML = '';
    currentQuestionIndex = 0;
    levelQuestions = [];
    hintUsedThisLevel = false; // Reset hint untuk level baru

    updateProgressBar(); // FITUR BARU

    levelQuestions = await getQuizQuestions(level.theme);
    if (levelQuestions && levelQuestions.length > 0) {
        loadQuizQuestion(levelQuestions[currentQuestionIndex]);
    } else {
         levelContentEl.innerHTML = `<div class="text-center text-red-400">
            <p>Arsip soal untuk zaman ini tidak ditemukan.</p>
            <button id="next-btn" class="btn-primary mt-4 py-2 px-6 rounded-lg">Lanjutkan ke Zaman Berikutnya</button>
        </div>`;
        document.getElementById('next-btn').addEventListener('click', moveToNextLevel);
    }
}

function loadQuizQuestion(questionData) {
    if (!questionData) return;
    
    const shuffledOptions = [...questionData.options].sort(() => Math.random() - 0.5);

    levelContentEl.innerHTML = `
        <div class="screen">
            <div class="flex justify-between items-center mb-4">
                <p class="text-lg md:text-xl text-center text-cyan-200 flex-grow">${questionData.question}</p>
                <!-- FITUR BARU: Tombol Bantuan -->
                <button id="hint-btn" class="btn-hint" title="Gunakan Bantuan 50:50 (-5 Poin)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5 6 6 0 0 1 6-5c.35.1.7.24 1.05.43"/><path d="M12 18v2"/><path d="M12 8V6"/><path d="m4.93 10.93-.93.93"/><path d="M18.1 11.87.93.93"/><path d="m4.93 15.07.93.93"/><path d="M18.1 14.13l.93.93"/><path d="M22 13h-2"/><path d="M6 13H4"/><path d="M12 2a4 4 0 0 0-2 7.5"/><path d="M12 6.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/></svg>
                    50:50
                </button>
            </div>
            <div id="options-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${shuffledOptions.map(opt => `<button class="btn-option p-4 rounded-lg text-lg">${opt}</button>`).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('hint-btn').addEventListener('click', () => useHint(questionData.answer));
    document.querySelectorAll('.btn-option').forEach(btn => {
        btn.addEventListener('click', () => checkQuizAnswer(btn.textContent, questionData.answer, questionData.explanation));
    });
}

// FITUR BARU: Fungsi untuk bantuan 50:50
function useHint(correctAnswer) {
    if (soundsReady) clickSound.triggerAttackRelease("A2", "8n");
    if (hintUsedThisLevel || score < 5) {
        const hintBtn = document.getElementById('hint-btn');
        hintBtn.classList.add('shake');
        setTimeout(() => hintBtn.classList.remove('shake'), 500);
        return;
    }
    
    hintUsedThisLevel = true;
    score -= 5;
    updateScoreDisplay();

    const optionButtons = Array.from(document.querySelectorAll('.btn-option'));
    const wrongOptions = optionButtons.filter(btn => btn.textContent !== correctAnswer);
    
    // Sembunyikan dua opsi yang salah
    wrongOptions.sort(() => 0.5 - Math.random()).slice(0, 2).forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.3';
    });

    document.getElementById('hint-btn').disabled = true;
    document.getElementById('hint-btn').style.opacity = '0.3';
}


function checkQuizAnswer(selectedAnswer, correctAnswer, explanation) {
    const isCorrect = selectedAnswer === correctAnswer;
    
    if (soundsReady) {
        isCorrect ? correctSound.triggerAttackRelease("C4", "8n") : incorrectSound.triggerAttackRelease("C3", "4n");
    }
    
    document.querySelectorAll('.btn-option').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === correctAnswer) btn.classList.add('correct');
        else if (btn.textContent === selectedAnswer) btn.classList.add('incorrect');
    });

    if (isCorrect) {
        score += 10;
        updateScoreDisplay();
    }

    showFeedback(isCorrect, explanation);
}

function showFeedback(isCorrect, explanation) {
    levelFeedbackEl.innerHTML = `
        <div class="card screen p-4 mt-4 ${isCorrect ? 'border-green-400' : 'border-red-400'}">
            <h3 class="font-bold text-xl ${isCorrect ? 'text-green-400' : 'text-red-400'}">${isCorrect ? 'Tepat Sekali!' : 'Hampir Benar'}</h3>
            <p class="text-md mt-2 text-gray-300">${explanation}</p>
            <button id="next-btn" class="btn-primary mt-4 py-2 px-6 rounded-lg">Lanjutkan</button>
        </div>
    `;
    document.getElementById('next-btn').addEventListener('click', nextStep);
}

function nextStep() {
    if (soundsReady) clickSound.triggerAttackRelease("C2", "8n");
    currentQuestionIndex++;
    if (currentQuestionIndex < levelQuestions.length) {
        levelFeedbackEl.innerHTML = '';
        loadQuizQuestion(levelQuestions[currentQuestionIndex]);
    } else {
        moveToNextLevel();
    }
}

function moveToNextLevel() {
    if (levelQuestions.length === 0 || score >= gameData[currentLevelIndex].minScore) {
        currentLevelIndex++;
        loadLevel(currentLevelIndex);
    } else {
        levelFeedbackEl.innerHTML = `
            <div class="card screen p-4 mt-4 border-yellow-400">
                <h3 class="font-bold text-xl text-yellow-400">Skor Belum Cukup!</h3>
                <p class="text-md mt-2 text-gray-300">Kamu butuh ${gameData[currentLevelIndex].minScore} poin untuk lanjut. Ayo coba lagi dari awal level ini!</p>
                <button id="retry-level-btn" class="btn-primary mt-4 py-2 px-6 rounded-lg">Ulangi Level</button>
            </div>
        `;
        document.getElementById('retry-level-btn').addEventListener('click', () => {
            if (soundsReady) clickSound.triggerAttackRelease("C2", "8n");
            score = currentLevelIndex > 0 ? gameData[currentLevelIndex-1].minScore - 10 : 0;
            updateScoreDisplay();
            loadLevel(currentLevelIndex);
        });
    }
}

function showEndScreen() {
    gameScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');
    endScreen.classList.add('screen');
    finalScoreEl.textContent = score;
}

function updateScoreDisplay() {
    scoreEl.textContent = score;
}

// FITUR BARU: Update progress bar
function updateProgressBar() {
    const progress = ((currentLevelIndex) / gameData.length) * 100;
    progressBarFill.style.width = `${progress}%`;
}

function toggleMusic() {
    if (isMusicPlaying) {
        bgMusic.pause();
        musicToggleBtn.textContent = '🎵 Musik: Mati';
    } else {
        bgMusic.play().catch(e => console.log("Musik tidak bisa diputar otomatis."));
        musicToggleBtn.textContent = '🎵 Musik: Hidup';
    }
    isMusicPlaying = !isMusicPlaying;
}

// --- EVENT LISTENERS ---
startBtn.addEventListener('click', () => {
    setupSounds(); // Inisialisasi audio saat game dimulai
    startGame();
});
restartBtn.addEventListener('click', () => {
    if (soundsReady) clickSound.triggerAttackRelease("C2", "8n");
    startGame();
});
musicToggleBtn.addEventListener('click', toggleMusic);
