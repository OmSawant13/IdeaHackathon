const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const googleTTS = require('google-tts-api');
const { translate } = require('@vitalets/google-translate-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

// ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ── NEW: Universal Translation with Fallback ──
async function universalTranslate(text, fromCode, toCode) {
  try {
    // Attempt 1: Google Translate (Preferred)
    const result = await translate(text, { from: fromCode, to: toCode });
    return result.text;
  } catch (error) {
    console.error(`Google Translate Failed: ${error.message}. Trying MyMemory fallback...`);

    // Attempt 2: MyMemory API Fallback
    try {
      // MyMemory requires explicit langpair like 'hi|en'
      const langPair = `${fromCode}|${toCode}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.responseData && data.responseData.translatedText) {
        console.log(`MyMemory Fallback Success (${langPair}): "${text}" -> "${data.responseData.translatedText}"`);
        return data.responseData.translatedText;
      }
    } catch (fallbackError) {
      console.error(`MyMemory Fallback also failed: ${fallbackError.message}`);
    }

    // Final Fallback: Return original text if everything fails
    return text;
  }
}


// ─────────────────────────────────────────────────────────────
// Gemini — Full Banking Intelligence Analysis
// ─────────────────────────────────────────────────────────────
// ── INTERNAL AI ANALYZERS ──

async function geminiAnalyze(text, senderRole, conversationHistory = []) {
  const historyStr = conversationHistory.length
    ? conversationHistory.map(m => `[${m.senderRole}]: ${m.originalText}`).join('\n')
    : 'No prior context';

  const prompt = `You are BankBridge, an Indian banking AI assistant.
Analyze this message and return ONLY JSON.
Role: ${senderRole}
Context: ${historyStr}
Message: "${text}"

JSON SCHEMA:
{
  "intent": "Account Opening/Savings Account/Loan Enquiry/KYC/etc",
  "subIntent": "Specific details or null",
  "confidence": 0-100,
  "isAmbiguous": boolean,
  "clarifyingQuestion": "Simple question if more info needed, else null",
  "keyEntities": ["list of entities"],
  "termExplanations": [
    {"term": "Complex Banking Jargon (EMI, CIBIL, moratorium, NEFT, etc.)", "simple": "1-sentence plain language explanation for a common person"}
  ],
  "fraudRisk": {"detected": boolean, "level": "none|low|medium|high", "reason": "string|null"},
  "customerProtection": {"alert": boolean, "message": "string|null"},
  "guidance": "1 sentence for banker",
  "urgency": "normal|high"
}

JARGON RULES: Any complex terms (moratorium, CIBIL, lien, hypothecation, KYC, collateral, etc.) MUST be explained in "termExplanations".`;

  const result = await geminiModel.generateContent(prompt);
  const raw = result.response.text().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  const jm = raw.match(/\{[\s\S]*\}/);
  if (!jm) throw new Error('No JSON in Gemini response');
  return JSON.parse(jm[jm.length - 1]);
}

async function ollamaAnalyze(text, senderRole, conversationHistory = []) {
  const historyStr = conversationHistory.length
    ? conversationHistory.map(m => `[${m.senderRole}]: ${m.originalText}`).join('\n')
    : 'No prior context';

  const systemPrompt = `You are a banking AI. Analyze the input and return ONLY structured JSON. 
JSON SCHEMA: {"intent":"string","subIntent":"string","confidence":number,"isAmbiguous":boolean,"clarifyingQuestion":"string|null","keyEntities":["string"],"termExplanations":[{"term":"string","simple":"string"}],"fraudRisk":{"detected":boolean,"level":"none|low|medium|high","reason":"string|null"},"customerProtection":{"alert":boolean,"message":"string|null"},"guidance":"string","urgency":"normal|high"}`;

  const userPrompt = `Role: ${senderRole}\nContext: ${historyStr}\nMessage: "${text}"`;

  try {
    let rawResponse = await ollamaChat(systemPrompt, userPrompt);
    rawResponse = rawResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Ollama Analysis Fallback Failed:", e.message);
  }

  // Minimal fallback object
  return {
    intent: 'General',
    subIntent: null,
    confidence: 50,
    isAmbiguous: false,
    clarifyingQuestion: null,
    keyEntities: [],
    termExplanations: [],
    fraudRisk: { detected: false, level: 'none', reason: null },
    customerProtection: { alert: false, message: null },
    guidance: 'Proceed with the general request.',
    urgency: 'normal'
  };
}

// ─────────────────────────────────────────────────────────────
// Universal AI Analysis with Resilient Fallback
// ─────────────────────────────────────────────────────────────
async function universalAnalyze(text, senderRole, conversationHistory = []) {
  try {
    // Attempt 1: Gemini (Advanced)
    console.log("[AI] Trying Gemini for analysis...");
    return await geminiAnalyze(text, senderRole, conversationHistory);
  } catch (error) {
    console.warn(`[AI] Gemini Failed: ${error.message}. Switching to Ollama local analysis...`);
    // Attempt 2: Ollama (Local/Resilient)
    return await ollamaAnalyze(text, senderRole, conversationHistory);
  }
}

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ─────────────────────────────────────────
// Ollama Config
// ─────────────────────────────────────────
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

async function ollamaChat(systemPrompt, userPrompt) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 512,
      }
    })
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message?.content?.trim() || '';
}

// Language name → Google TTS language code
const LANG_TO_TTS_CODE = {
  'Hindi': 'hi', 'Marathi': 'mr', 'Gujarati': 'gu',
  'Tamil': 'ta', 'Telugu': 'te', 'Kannada': 'kn',
  'Bengali': 'bn', 'English': 'en',
};

// ─────────────────────────────────────────
// Banking Terminology Glossary
// Correct banking term translations per language
// ─────────────────────────────────────────

// Step 1: Expand abbreviations before translation
const BANKING_ABBREVIATIONS = {
  '\\bfd\\b': 'fixed deposit',
  '\\brd\\b': 'recurring deposit',
  '\\bemi\\b': 'equated monthly installment',
  '\\bkyc\\b': 'know your customer (KYC)',
  '\\bneft\\b': 'NEFT bank transfer',
  '\\brtgs\\b': 'RTGS bank transfer',
  '\\bupi\\b': 'UPI payment',
  '\\batm\\b': 'ATM',
  '\\bnri\\b': 'non resident indian',
  '\\bnre\\b': 'non resident external account',
  '\\bpan\\b': 'PAN card',
  '\\boan\\b': 'loan',
};

function expandAbbreviations(text) {
  let result = text.toLowerCase();
  for (const [pattern, expansion] of Object.entries(BANKING_ABBREVIATIONS)) {
    result = result.replace(new RegExp(pattern, 'gi'), expansion);
  }
  return result;
}

// Step 2: Post-translation banking term correction (key term → correct banking translation)
const BANKING_GLOSSARY = {
  'hi': { // Hindi
    'fixed deposit': 'सावधि जमा (FD)',
    'recurring deposit': 'आवर्ती जमा (RD)',
    'savings account': 'बचत खाता',
    'current account': 'चालू खाता',
    'home loan': 'गृह ऋण',
    'personal loan': 'व्यक्तिगत ऋण',
    'education loan': 'शिक्षा ऋण',
    'gold loan': 'स्वर्ण ऋण',
    'vehicle loan': 'वाहन ऋण',
    'know your customer': 'केवाईसी (KYC)',
    'equated monthly installment': 'समान मासिक किस्त (EMI)',
    'passbook': 'पासबुक',
    'cheque': 'चेक',
    'balance': 'शेष राशि',
    'interest rate': 'ब्याज दर',
    'account number': 'खाता संख्या',
    'account opening': 'खाता खोलना',
    'account closure': 'खाता बंद करना',
    'net banking': 'नेट बैंकिंग',
    'mobile banking': 'मोबाइल बैंकिंग',
    'debit card': 'डेबिट कार्ड',
    'credit card': 'क्रेडिट कार्ड',
    'fund transfer': 'धन हस्तांतरण',
    'nomination': 'नामांकन',
  },
  'mr': { // Marathi
    'fixed deposit': 'मुदत ठेव (FD)',
    'recurring deposit': 'आवर्ती ठेव (RD)',
    'savings account': 'बचत खाते',
    'current account': 'चालू खाते',
    'home loan': 'गृह कर्ज',
    'personal loan': 'वैयक्तिक कर्ज',
    'education loan': 'शैक्षणिक कर्ज',
    'gold loan': 'सोने कर्ज',
    'vehicle loan': 'वाहन कर्ज',
    'know your customer': 'केवायसी (KYC)',
    'equated monthly installment': 'समान मासिक हप्ता (EMI)',
    'passbook': 'पासबुक',
    'cheque': 'धनादेश',
    'balance': 'शिल्लक',
    'interest rate': 'व्याज दर',
    'account number': 'खाते क्रमांक',
    'account opening': 'खाते उघडणे',
    'account closure': 'खाते बंद करणे',
    'net banking': 'नेट बँकिंग',
    'mobile banking': 'मोबाइल बँकिंग',
    'debit card': 'डेबिट कार्ड',
    'credit card': 'क्रेडिट कार्ड',
    'fund transfer': 'निधी हस्तांतरण',
    'nomination': 'नामनिर्देशन',
  },
  'gu': { // Gujarati
    'fixed deposit': 'મુદ્દત થાપણ (FD)',
    'recurring deposit': 'આવર્તક થાપણ (RD)',
    'savings account': 'બચત ખાતું',
    'current account': 'ચાલુ ખાતું',
    'home loan': 'ગૃહ ઋણ',
    'personal loan': 'વ્યક્તિગત ઋણ',
    'know your customer': 'KYC',
    'equated monthly installment': 'EMI',
    'cheque': 'ચેક',
    'balance': 'બાકી રકم',
    'net banking': 'નેટ બેન્કિંગ',
  },
  'ta': { // Tamil
    'fixed deposit': 'நிலையான வைப்பு (FD)',
    'recurring deposit': 'தொடர் வைப்பு (RD)',
    'savings account': 'சேமிப்பு கணக்கு',
    'current account': 'நடப்பு கணக்கு',
    'home loan': 'வீட்டு கடன்',
    'personal loan': 'தனிப்பட்ட கடன்',
    'know your customer': 'KYC',
    'equated monthly installment': 'EMI',
    'cheque': 'காசோலை',
    'balance': 'இருப்பு',
    'net banking': 'நெட் பேங்கிங்',
  },
  'te': { // Telugu
    'fixed deposit': 'స్థిర డిపాజిట్ (FD)',
    'recurring deposit': 'పునరావృత డిపాజిట్ (RD)',
    'savings account': 'పొదుపు ఖాతా',
    'current account': 'కరెంట్ ఖాతా',
    'home loan': 'గృహ రుణం',
    'personal loan': 'వ్యక్తిగత రుణం',
    'know your customer': 'KYC',
    'equated monthly installment': 'EMI',
    'cheque': 'చెక్కు',
    'balance': 'బ్యాలెన్స్',
    'net banking': 'నెట్ బ్యాంకింగ్',
  },
  'kn': { // Kannada
    'fixed deposit': 'ಸ್ಥಿರ ಠೇವಣಿ (FD)',
    'recurring deposit': 'ಆವರ್ತಕ ಠೇವಣಿ (RD)',
    'savings account': 'ಉಳಿತಾಯ ಖಾತೆ',
    'current account': 'ಚಾಲ್ತಿ ಖಾತೆ',
    'home loan': 'ಗೃಹ ಸಾಲ',
    'personal loan': 'ವೈಯಕ್ತಿಕ ಸಾಲ',
    'know your customer': 'KYC',
    'equated monthly installment': 'EMI',
    'cheque': 'ಚೆಕ್ಕು',
    'balance': 'ಬ್ಯಾಲೆನ್ಸ್',
    'net banking': 'ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್',
  },
  'bn': { // Bengali
    'fixed deposit': 'স্থায়ী আমানত (FD)',
    'recurring deposit': 'পুনরাবৃত্তি আমানত (RD)',
    'savings account': 'সঞ্চয় অ্যাকাউন্ট',
    'current account': 'চলতি অ্যাকাউন্ট',
    'home loan': 'গৃহ ঋণ',
    'personal loan': 'ব্যক্তিগত ঋণ',
    'know your customer': 'KYC',
    'equated monthly installment': 'EMI',
    'cheque': 'চেক',
    'balance': 'ব্যালেন্স',
    'net banking': 'নেট ব্যাংকিং',
  },
};

// Apply banking glossary corrections to translated text
function applyBankingGlossary(translatedText, originalText, langCode) {
  const glossary = BANKING_GLOSSARY[langCode];
  if (!glossary) return translatedText;

  const originalLower = originalText.toLowerCase();
  let result = translatedText;

  // Check which banking terms appear in the ORIGINAL English text
  // and replace/append correct banking terms in the translation
  for (const [engTerm, localTerm] of Object.entries(glossary)) {
    if (originalLower.includes(engTerm)) {
      // If translated text doesn't already contain the correct term, append hint
      if (!result.includes(localTerm)) {
        // Try to replace common incorrect translations
        result = result + (result.endsWith('.') || result.endsWith('?') ? '' : ' ') + `(${localTerm})`;
      }
    }
  }
  return result;
}

const { spawn } = require('child_process');
const path = require('path');

let ttsWorker = null;
let ttsQueue = [];
let isWorkerReady = false;

function spawnTTSWorker() {
  const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python');
  const scriptPath = path.join(__dirname, 'tts_worker.py');
  
  console.log('[Parler-TTS] Starting persistent worker...');
  ttsWorker = spawn(venvPython, [scriptPath]);

  ttsWorker.stdout.on('data', (data) => {
    const output = data.toString();
    try {
      const response = JSON.parse(output);
      if (ttsQueue.length > 0) {
        const { resolve, reject } = ttsQueue.shift();
        if (response.status === 'success') {
          resolve(`data:audio/wav;base64,${response.audio}`);
        } else {
          reject(new Error(response.message));
        }
      }
    } catch (e) {
      // Not JSON, might be status messages
      if (output.includes('READY')) {
        console.log('[Parler-TTS] Worker is READY.');
        isWorkerReady = true;
      }
    }
  });

  ttsWorker.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('DEBUG:')) {
      console.log(`[Parler-TTS-Worker] ${msg.trim()}`);
    } else if (msg.includes('READY')) {
      console.log('[Parler-TTS] Worker is READY.');
      isWorkerReady = true;
    } else {
      console.warn(`[Parler-TTS-Worker] ${msg.trim()}`);
    }
  });

  ttsWorker.on('exit', (code) => {
    console.warn(`[Parler-TTS] Worker exited with code ${code}. Restarting...`);
    isWorkerReady = false;
    ttsWorker = null;
    // Notify pending requests
    while (ttsQueue.length > 0) {
      const { reject } = ttsQueue.shift();
      reject(new Error("Worker exited prematurely"));
    }
    setTimeout(spawnTTSWorker, 5000); // Wait 5s before restart
  });
}

// Initialize worker
spawnTTSWorker();

async function getParlerTTS(text) {
  if (!isWorkerReady) {
    throw new Error("Parler-TTS worker is not ready yet");
  }

  return new Promise((resolve, reject) => {
    // Set a generation timeout (5s) to avoid hanging
    const timeout = setTimeout(() => {
      const index = ttsQueue.findIndex(q => q.resolve === resolve);
      if (index !== -1) {
        ttsQueue.splice(index, 1);
        reject(new Error("Parler-TTS generation timeout"));
      }
    }, 5000);

    const oldResolve = resolve;
    resolve = (data) => {
      clearTimeout(timeout);
      oldResolve(data);
    };

    ttsQueue.push({ resolve, reject });
    ttsWorker.stdin.write(JSON.stringify({ text }) + '\n');
  });
}

// Fetch Google TTS audio SERVER-SIDE → avoid browser CORS issues
async function getTTSBase64(text, langName) {
  try {
    // Try Parler-TTS first if provider is set to 'parler'
    if (process.env.TTS_PROVIDER === 'parler' || (!process.env.TTS_PROVIDER && langName === 'English')) {
      try {
        console.log(`[AI] Using Parler-TTS for: ${text.substring(0, 30)}...`);
        return await getParlerTTS(text);
      } catch (e) {
        console.warn(`[AI] Parler-TTS failed: ${e.message}. Falling back to Google TTS.`);
      }
    }

    const langCode = LANG_TO_TTS_CODE[langName] || 'en';
    const chunks = googleTTS.getAllAudioUrls(text, {
      lang: langCode,
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: ',.!?।',
    });

    // Fetch all chunks in parallel
    const buffers = await Promise.all(
      chunks.map(async ({ url }) => {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Referer': 'https://translate.google.com/',
          },
        });
        if (!res.ok) throw new Error(`TTS fetch ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      })
    );

    const combined = Buffer.concat(buffers);
    const base64 = combined.toString('base64');
    console.log(`TTS: ${langCode} | ${text.substring(0, 30)}... | ${combined.length} bytes`);
    return `data:audio/mpeg;base64,${base64}`;
  } catch (e) {
    console.warn('TTS fetch failed:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────
// Banking Knowledge Base
// ─────────────────────────────────────────
const BANKING_KB = {
  "savings account": {
    documents: ["Aadhaar Card", "PAN Card", "2 Passport Photos", "Address Proof"],
    steps: ["Verify identity documents", "Fill account opening form", "Complete KYC (Video/In-person)", "Initial deposit (min ₹500)", "Issue passbook & debit card"],
    info: "Zero-balance savings accounts available under PMJDY scheme."
  },
  "current account": {
    documents: ["Business registration certificate", "PAN Card", "Address Proof", "2 Passport Photos"],
    steps: ["Verify business documents", "Fill account opening form", "Complete due diligence", "Initial deposit (min ₹5000)", "Issue chequebook"],
    info: "Overdraft facility up to 50% of average monthly balance."
  },
  "home loan": {
    documents: ["Income proof (6 months salary slip)", "ITR (2 years)", "Property documents", "Aadhaar + PAN", "Bank statements (6 months)"],
    steps: ["Check eligibility (income × 60 = max EMI)", "Submit documents", "Property verification by bank", "Legal + technical report", "Loan sanction & disbursal"],
    info: "Interest rate: 8.5%–9.5% p.a. | Max tenure: 30 years | Max amount: ₹5 Crore"
  },
  "personal loan": {
    documents: ["Salary slips (3 months)", "Bank statements (6 months)", "Aadhaar + PAN", "Employment letter"],
    steps: ["Check credit score (min 700)", "Submit KYC documents", "Income verification", "Loan approval (2–3 days)", "Disbursal to account"],
    info: "Interest rate: 10.5%–15% p.a. | Max amount: ₹25 Lakhs | Tenure: 1–5 years"
  },
  "fd": {
    documents: ["Aadhaar + PAN (for TDS exemption Form 15G/15H)"],
    steps: ["Choose FD tenure", "Decide payout (monthly/quarterly/maturity)", "Submit form + KYC", "FD receipt issued"],
    info: "Rates: 6.5% (1yr) | 7.1% (2yr) | 7.5% (3yr) | Senior citizen: +0.5% extra"
  },
  "fixed deposit": {
    documents: ["Aadhaar + PAN (for TDS exemption Form 15G/15H)"],
    steps: ["Choose FD tenure", "Decide payout (monthly/quarterly/maturity)", "Submit form + KYC", "FD receipt issued"],
    info: "Rates: 6.5% (1yr) | 7.1% (2yr) | 7.5% (3yr) | Senior citizen: +0.5% extra"
  },
  "loan": {
    documents: ["KYC Documents (Aadhaar + PAN)", "Income proof", "Bank statements"],
    steps: ["Identify loan type", "Check eligibility", "Submit documents", "Await appraisal", "Disbursal"],
    info: "Loan types: Home, Personal, Gold, Education, Business, Vehicle"
  },
  "kyc": {
    documents: ["Aadhaar Card (mandatory)", "PAN Card", "One utility bill"],
    steps: ["Collect original + photocopy documents", "Verify via UIDAI Aadhaar portal", "Complete re-KYC form", "Update records"],
    info: "RBI mandates KYC update every 2 years for high-risk customers, 10 years for low-risk."
  },
  "debit card": {
    documents: ["Account passbook / account number", "Aadhaar OTP verification"],
    steps: ["Customer submits request", "Verify account ownership", "Block old card if lost", "New card dispatched in 5–7 days", "Activate at ATM with first PIN"],
    info: "Instant virtual debit card available for digital transactions."
  },
  "balance enquiry": {
    documents: [],
    steps: ["Verify customer identity", "Ask account number or registered mobile", "Share balance (verbal/printed)"],
    info: "Customers can also check via: Missed call (18001234), Net banking, Bank app."
  },
  "net banking": {
    documents: ["Account number", "Registered mobile number", "Aadhaar OTP"],
    steps: ["Customer visits website or app", "Register with account number + OTP", "Set login & transaction passwords", "Complete 2FA setup"],
    info: "Net banking limit: ₹10 Lakh/day (default). Can be enhanced via branch."
  }
};

function getKnowledgeBase(intent) {
  if (!intent) return null;
  const key = Object.keys(BANKING_KB).find(k => intent.toLowerCase().includes(k));
  return key ? BANKING_KB[key] : null;
}

// ─────────────────────────────────────────
// Socket.io Events
// ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // User explicitly telling others what they speak
  socket.on('sync-language', (roomId, speakingLang) => {
    socket.to(roomId).emit('partner-language-changed', {
      newLang: speakingLang,
      senderId: socket.id
    });
  });

  // User asking others to tell them what they speak
  socket.on('request-sync', (roomId) => {
    socket.to(roomId).emit('please-sync');
  });

  // ── Main Translation + Intent Detection ──
  socket.on('send-message', async ({ roomId, text, fromLang, targetLang, context, senderRole, conversationHistory }) => {
    try {
      const LANG_NAME_TO_GT = {
        'Hindi': 'hi', 'Marathi': 'mr', 'Gujarati': 'gu',
        'Tamil': 'ta', 'Telugu': 'te', 'Kannada': 'kn',
        'Bengali': 'bn', 'English': 'en',
      };

      // Use explicit codes for both source and target to fix MyMemory error
      const fromCode = LANG_NAME_TO_GT[fromLang] || 'auto';
      const gtLang = LANG_NAME_TO_GT[targetLang] || 'en';

      // Use Universal Translate with multi-layer fallback
      const translatedText = await universalTranslate(text, fromCode, gtLang);

      console.log(`[${senderRole}] "${text}" → (${gtLang}) "${translatedText}"`);

      // Broadcast translation IMMEDIATELY
      io.to(roomId).emit('receive-translation', {
        senderId: socket.id,
        senderRole: senderRole || 'unknown',
        originalText: text,
        translatedText,
        targetLang,
        intent: 'General',
        confidence: 0,
        keyEntities: [],
        knowledgeBase: null,
      });

      // TTS: send ONLY to receiver — fixes double speech & language mismatch
      getTTSBase64(translatedText, targetLang).then(ttsAudio => {
        if (ttsAudio) socket.to(roomId).emit('tts-audio', { senderId: socket.id, ttsAudio });
      }).catch(e => console.warn('TTS error:', e.message));

      // Universal AI analysis: progressive intent + fraud + customer protection
      const history = Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : [];
      universalAnalyze(text, senderRole, history)
        .then((analysis) => {
          const kb = getKnowledgeBase(analysis.intent);
          console.log(`[AI-Insight] intent=${analysis.intent} fraud=${analysis.fraudRisk?.level} confidence=${analysis.confidence}%`);

          io.to(roomId).emit('intent-update', {
            senderId: socket.id,
            intent: analysis.intent,
            subIntent: analysis.subIntent,
            confidence: analysis.confidence,
            isAmbiguous: analysis.isAmbiguous,
            clarifyingQuestion: analysis.clarifyingQuestion,
            keyEntities: analysis.keyEntities,
            termExplanations: analysis.termExplanations || [],
            knowledgeBase: kb,
            fraudRisk: analysis.fraudRisk,
            customerProtection: analysis.customerProtection,
            guidance: analysis.guidance,
            urgency: analysis.urgency,
          });
        })
        .catch(e => {
          console.warn('AI analysis failed completely:', e.message);
        });

    } catch (error) {
      console.error('Translation Error:', error.message);
      socket.emit('translation-error', { message: `Translation failed: ${error.message}` });
    }
  });

  // ── Session Summary Generation ──
  socket.on('generate-summary', async ({ roomId, conversation, customerLang, targetLang }) => {
    try {
      const conversationText = conversation
        .map(m => `[${m.senderRole || 'User'}] ${m.originalText} → ${m.translatedText}`)
        .join('\n');

      const systemPrompt = `You are BankBridge. Generate a professional, bilingual banking session summary. Return ONLY valid JSON — no markdown, no preamble.

OUTPUT FORMAT:
{"titleEn":"<title>","titleCustomer":"<title in customer language>","intent":"<primary intent>","summaryEn":"<2-3 sentences>","summaryCustomer":"<same in ${customerLang}>","documentsRequired":["<doc1>"],"nextSteps":["<step1>"],"status":"Explained"}`;

      const userPrompt = `CONVERSATION:\n${conversationText}\n\nCUSTOMER LANGUAGE: ${customerLang}\nSTAFF LANGUAGE: ${targetLang}`;

      let rawResponse = await ollamaChat(systemPrompt, userPrompt);
      rawResponse = rawResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      rawResponse = jsonMatch ? jsonMatch[0] : rawResponse;

      let summary;
      try {
        summary = JSON.parse(rawResponse);
      } catch {
        summary = {
          titleEn: 'Banking Session',
          intent: 'General',
          summaryEn: rawResponse,
          summaryCustomer: rawResponse,
          documentsRequired: [],
          nextSteps: [],
          status: 'Completed'
        };
      }

      socket.emit('session-summary', summary);

    } catch (error) {
      console.error('Summary Error:', error.message);
      socket.emit('translation-error', { message: 'Summary generation failed.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`BankBridge server running on port ${PORT}`);
  console.log(`Using Ollama model: ${OLLAMA_MODEL} at ${OLLAMA_HOST}`);
});
