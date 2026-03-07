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

// Gemini for smart intent detection
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

async function geminiIntentDetect(text) {
  const prompt = `You are a banking assistant AI. Analyze the following text and detect the banking service intent.

Text: "${text}"

Available intents:
Account Opening, Savings Account, Current Account, Home Loan, Personal Loan, Education Loan, Gold Loan, Loan Enquiry, Fixed Deposit, Recurring Deposit, KYC, KYC Update, Debit Card Issue, Credit Card, Card Block, Balance Enquiry, Statement Request, Net Banking, UPI, Mobile Banking, Fund Transfer, NEFT, RTGS, Cheque Issue, Stop Cheque, Nomination Update, Account Closure, General

Return ONLY valid JSON (no markdown, no explanation):
{"intent": "<exact intent from list>", "confidence": <0-100>, "keyEntities": ["<key term1>", "<key term2>"]}`;

  const result = await geminiModel.generateContent(prompt);
  const raw = result.response.text().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  const jm = raw.match(/\{[\s\S]*\}/);
  if (!jm) throw new Error('No JSON in Gemini response');
  return JSON.parse(jm[0]);
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

// Fetch Google TTS audio SERVER-SIDE → avoid browser CORS issues
async function getTTSBase64(text, langName) {
  try {
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

  // ── Main Translation + Intent Detection ──
  socket.on('send-message', async ({ roomId, text, targetLang, context, senderRole }) => {
    try {
      const LANG_NAME_TO_GT = {
        'Hindi': 'hi', 'Marathi': 'mr', 'Gujarati': 'gu',
        'Tamil': 'ta', 'Telugu': 'te', 'Kannada': 'kn',
        'Bengali': 'bn', 'English': 'en',
      };
      const gtLang = LANG_NAME_TO_GT[targetLang] || 'en';

      // Step 1: Google Translate (fast ~300-500ms)
      const expandedText = expandAbbreviations(text);
      const gtResult = await translate(expandedText, { to: gtLang });
      const translatedText = applyBankingGlossary(gtResult.text, expandedText, gtLang);

      console.log(`[${senderRole}] "${text}" → (${gtLang}) "${translatedText}"`);

      // Broadcast translation IMMEDIATELY with General intent (Gemini will update it soon)
      io.to(roomId).emit('receive-translation', {
        senderId: socket.id,
        senderRole: senderRole || 'unknown',
        originalText: text,
        translatedText,
        targetLang,
        intent: 'General',
        confidence: 70,
        keyEntities: [],
        knowledgeBase: null,
      });

      // TTS: send ONLY to receiver — fixes double speech & language mismatch
      getTTSBase64(translatedText, targetLang).then(ttsAudio => {
        if (ttsAudio) socket.to(roomId).emit('tts-audio', { senderId: socket.id, ttsAudio });
      }).catch(e => console.warn('TTS error:', e.message));

      // Gemini intent detection: smart, AI-based, runs in background
      geminiIntentDetect(text)
        .then(({ intent, confidence, keyEntities }) => {
          const kb = getKnowledgeBase(intent);
          io.to(roomId).emit('intent-update', {
            senderId: socket.id,
            intent,
            confidence,
            keyEntities,
            knowledgeBase: kb,
          });
          console.log(`[Gemini intent] ${intent} (${confidence}%)`);
        })
        .catch(e => {
          console.warn('Gemini intent failed, skipping:', e.message);
          // No fallback needed — message already shows with General intent
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
