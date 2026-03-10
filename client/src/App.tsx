import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Mic, MicOff, Users, LogOut, ShieldCheck, ChevronRight,
  Copy, Check, Sparkles, FileText, BookOpen, AlertCircle, CheckCircle2,
  ChevronDown, Clock, Landmark, Volume2, ShieldAlert, HelpCircle, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'hi-IN', name: 'Hindi', label: 'हिंदी' },
  { code: 'mr-IN', name: 'Marathi', label: 'मराठी' },
  { code: 'gu-IN', name: 'Gujarati', label: 'ગુજરાતી' },
  { code: 'ta-IN', name: 'Tamil', label: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', label: 'తెలుగు' },
  { code: 'kn-IN', name: 'Kannada', label: 'ಕನ್ನಡ' },
  { code: 'en-US', name: 'English', label: 'English' },
];

const INTENT_COLORS: Record<string, string> = {
  'Account Opening': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Savings Account': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Home Loan': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Personal Loan': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Loan Enquiry': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Fixed Deposit': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'KYC': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'KYC Update': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Debit Card Issue': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'Balance Enquiry': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'General': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const UI_STRINGS: Record<string, any> = {
  'en-US': {
    title: 'BankBridge', subtitle: 'AI Multilingual Banking Assistant',
    interfaceLang: 'Interface Language', speakingLang: 'Speaking Language',
    targetLang: 'Translate To', userRole: 'Your Role',
    banker: 'Bank Staff', client: 'Customer',
    createRoom: 'Start New Session', roomCode: 'Enter Session Code',
    join: 'Join Session', listening: 'Listening...', holdToTalk: 'Push to Talk',
    releaseToSend: 'Release to Send', endSession: 'End Session',
    generatingSummary: 'Generating Summary...', sessionSummary: 'Session Summary',
    intent: 'Detected Intent', guidance: 'Process Guidance',
    knowledgeBase: 'Knowledge Base', documentsRequired: 'Documents Required',
    nextSteps: 'Next Steps', exportSummary: 'Export Summary',
    newSession: 'New Session', status: 'Status',
  },
  'mr-IN': {
    title: 'बँकब्रिज', subtitle: 'AI बहुभाषिक बँकिंग सहाय्यक',
    interfaceLang: 'इंटरफेस भाषा', speakingLang: 'बोलण्याची भाषा',
    targetLang: 'अनुवाद करा', userRole: 'तुमची भूमिका',
    banker: 'बँक कर्मचारी', client: 'ग्राहक',
    createRoom: 'नवीन सत्र सुरू करा', roomCode: 'सत्र कोड प्रविष्ट करा',
    join: 'सत्रात सामील व्हा', listening: 'ऐकत आहे...', holdToTalk: 'बोलण्यासाठी दाबा',
    releaseToSend: 'पाठवण्यासाठी सोडा', endSession: 'सत्र संपवा',
    generatingSummary: 'सारांश तयार होत आहे...', sessionSummary: 'सत्र सारांश',
    intent: 'हेतू ओळखला', guidance: 'प्रक्रिया मार्गदर्शन',
    knowledgeBase: 'माहिती केंद्र', documentsRequired: 'आवश्यक कागदपत्रे',
    nextSteps: 'पुढील पायऱ्या', exportSummary: 'सारांश निर्यात करा',
    newSession: 'नवीन सत्र', status: 'स्थिती',
  },
  'hi-IN': {
    title: 'बैंकब्रिज', subtitle: 'AI बहुभाषी बैंकिंग सहायक',
    interfaceLang: 'इंटरफेस भाषा', speakingLang: 'बोलने की भाषा',
    targetLang: 'अनुवाद करें', userRole: 'आपकी भूमिका',
    banker: 'बैंक कर्मचारी', client: 'ग्राहक',
    createRoom: 'नया सत्र शुरू करें', roomCode: 'सत्र कोड दर्ज करें',
    join: 'सत्र में शामिल हों', listening: 'सुन रहा है...', holdToTalk: 'बोलने के लिए दबाएं',
    releaseToSend: 'भेजने के लिए छोड़ें', endSession: 'सत्र समाप्त करें',
    generatingSummary: 'सारांश बना रहा है...', sessionSummary: 'सत्र सारांश',
    intent: 'पहचाना गया इरादा', guidance: 'प्रक्रिया मार्गदर्शन',
    knowledgeBase: 'ज्ञान आधार', documentsRequired: 'आवश्यक दस्तावेज',
    nextSteps: 'अगले कदम', exportSummary: 'सारांश निर्यात करें',
    newSession: 'नया सत्र', status: 'स्थिति',
  }
};

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Message {
  senderId: string;
  senderRole: string;
  originalText: string;
  translatedText: string;
  targetLang: string;
  intent?: string;
  confidence?: number;
  keyEntities?: string[];
  knowledgeBase?: { documents: string[]; steps: string[]; info: string } | null;
  ttsUrls?: string[];
  ttsAudio?: string; // base64 for replay
}
interface Summary {
  titleEn: string;
  titleCustomer?: string;
  intent: string;
  summaryEn: string;
  summaryCustomer?: string;
  documentsRequired: string[];
  nextSteps: string[];
  status: string;
}

// ─────────────────────────────────────────────────────────────
// UNIVERSAL INSIGHT SIDEBAR COMPONENT
// ─────────────────────────────────────────────────────────────
const InsightSidebar = ({ messages, t, role }: { messages: Message[]; t: any; role: string }) => {
  const lastWithIntent = [...messages].reverse().find(m => m.intent && m.intent !== 'General');
  const latest = messages[messages.length - 1];
  // Use most recent message that has rich AI data
  const rich = lastWithIntent || latest;
  const intent = rich?.intent;
  const subIntent = (rich as any)?.subIntent;
  const kb = rich?.knowledgeBase;
  const confidence = rich?.confidence;
  const entities = rich?.keyEntities || [];
  const fraudRisk = (rich as any)?.fraudRisk;
  const customerProtection = (rich as any)?.customerProtection;
  const clarifyingQuestion = (rich as any)?.clarifyingQuestion;
  const guidance = (rich as any)?.guidance;
  const isAmbiguous = (rich as any)?.isAmbiguous;

  const intentColor = intent ? (INTENT_COLORS[intent] || INTENT_COLORS['General']) : INTENT_COLORS['General'];
  const isBanker = role === 'Banker';

  // If customer has no jargon yet, we show a friendly guide
  const hasJargon = (rich as any)?.termExplanations && (rich as any).termExplanations.length > 0;

  return (
    <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">

      {/* 🚨 Fraud Risk Alert — Banker Only */}
      {isBanker && fraudRisk?.detected && fraudRisk.level !== 'none' && (
        <div className={`p-4 rounded-2xl border animate-pulse ${fraudRisk.level === 'high' ? 'bg-red-500/20 border-red-500/50' :
          fraudRisk.level === 'medium' ? 'bg-orange-500/20 border-orange-500/40' :
            'bg-yellow-500/10 border-yellow-500/30'
          }`}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={16} className={fraudRisk.level === 'high' ? 'text-red-400' : 'text-orange-400'} />
            <span className={`text-xs font-bold uppercase tracking-widest ${fraudRisk.level === 'high' ? 'text-red-400' : 'text-orange-400'
              }`}>
              ⚠ Fraud Risk: {fraudRisk.level.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{fraudRisk.reason}</p>
        </div>
      )}

      {/* 🛡️ Customer Protection Alert — Banker Only */}
      {isBanker && customerProtection?.alert && customerProtection.message && (
        <div className="p-4 rounded-2xl border border-orange-500/40 bg-orange-500/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-orange-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Policy Breach</span>
          </div>
          <p className="text-sm text-orange-200 leading-relaxed">{customerProtection.message}</p>
        </div>
      )}

      {/* 💬 Clarifying Question — Banker Only */}
      {isBanker && isAmbiguous && clarifyingQuestion && (
        <div className="p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle size={14} className="text-yellow-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Ask Customer</span>
          </div>
          <p className="text-sm text-yellow-100 font-medium leading-relaxed">❝ {clarifyingQuestion} ❞</p>
        </div>
      )}

      {/* 📖 Terms Explained */}
      {hasJargon ? (
        <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-500/10">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-purple-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Terms Simplified</span>
          </div>
          <div className="space-y-3">
            {(rich as any).termExplanations.map((exp: any, i: number) => (
              <div key={i} className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                <p className="text-xs font-bold text-purple-300 mb-1">{exp.term}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{exp.simple}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !isBanker && (
          <div className="p-4 rounded-2xl border border-slate-800/50 bg-slate-800/20 italic text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed">
              Waiting for banking terms to explain...
            </p>
          </div>
        )
      )}

      {/* Intent Card */}
      <div className="glass-dark p-4 rounded-2xl border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-indigo-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.intent}</span>
        </div>
        {intent && intent !== 'General' ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${intentColor}`}>
                {intent}
              </span>
              {subIntent && subIntent !== intent && (
                <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30">
                  → {subIntent}
                </span>
              )}
            </div>
            {confidence !== undefined && confidence > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Confidence</span><span>{confidence}%</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full">
                  <div className="h-1 bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${confidence}%` }} />
                </div>
              </div>
            )}
            {entities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entities.map((e, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-800 rounded-full text-slate-400">{e}</span>
                ))}
              </div>
            )}
            {/* Guidance */}
            {guidance && (
              <div className="mt-3 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-[11px] text-indigo-200 leading-relaxed">💡 {guidance}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-slate-500 text-xs italic">Listening for banking intent...</p>
        )}
      </div>

      {/* Guidance Card */}
      {kb?.steps && kb.steps.length > 0 && (
        <div className="glass-dark p-4 rounded-2xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.guidance}</span>
          </div>
          <ol className="space-y-2">
            {kb.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-slate-300 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Documents Card */}
      {kb?.documents && kb.documents.length > 0 && (
        <div className="glass-dark p-4 rounded-2xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} className="text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.documentsRequired}</span>
          </div>
          <ul className="space-y-1.5">
            {kb.documents.map((doc, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 size={12} className="text-amber-400 flex-shrink-0" />
                {doc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Knowledge Base Info */}
      {kb?.info && (
        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{t.knowledgeBase}</span>
          </div>
          <p className="text-sm text-blue-200/80 leading-relaxed">{kb.info}</p>
        </div>
      )}

      {/* Empty state */}
      {!kb && (!intent || intent === 'General') && !fraudRisk?.detected && !clarifyingQuestion && (
        <div className="flex flex-col items-center justify-center text-center py-8 opacity-20">
          <Landmark size={32} className="mb-3" />
          <p className="text-xs">AI guidance appears here when customer intent is detected</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SESSION SUMMARY SCREEN
// ─────────────────────────────────────────────────────────────
const SummaryScreen = ({ summary, t, onNewSession }: { summary: Summary; t: any; onNewSession: () => void }) => {
  const statusColors: Record<string, string> = {
    'Explained': 'bg-emerald-500/20 text-emerald-300',
    'Resolved': 'bg-emerald-500/20 text-emerald-300',
    'Pending': 'bg-amber-500/20 text-amber-300',
    'Follow-up Required': 'bg-rose-500/20 text-rose-300',
    'Completed': 'bg-blue-500/20 text-blue-300',
  };

  const exportText = `
BankBridge – Session Summary
==============================
Intent: ${summary.intent}
Status: ${summary.status}

SUMMARY (English):
${summary.summaryEn}

SUMMARY (Customer Language):
${summary.summaryCustomer || 'N/A'}

DOCUMENTS REQUIRED:
${summary.documentsRequired.map((d, i) => `${i + 1}. ${d}`).join('\n') || 'None'}

NEXT STEPS:
${summary.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'None'}
  `.trim();

  const copyExport = () => navigator.clipboard.writeText(exportText);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen bg-[#050810] text-slate-200 flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-500/10 rounded-2xl mb-2">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">{t.sessionSummary}</h1>
          <p className="text-slate-500 text-sm">{new Date().toLocaleString()}</p>
        </div>

        <div className="glass-dark rounded-3xl border border-slate-700/50 p-6 space-y-5">
          {/* Intent + Status row */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.intent}</label>
              <p className="font-semibold text-lg mt-0.5">{summary.intent}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[summary.status] || 'bg-slate-500/20 text-slate-300'}`}>
              {summary.status}
            </span>
          </div>

          <hr className="border-slate-800" />

          {/* English summary */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Summary (English)</label>
            <p className="text-slate-300 mt-1 leading-relaxed">{summary.summaryEn}</p>
          </div>

          {/* Customer language summary */}
          {summary.summaryCustomer && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Summary (Customer Language)</label>
              <p className="text-slate-300 mt-1 leading-relaxed">{summary.summaryCustomer}</p>
            </div>
          )}

          <hr className="border-slate-800" />

          <div className="grid grid-cols-2 gap-4">
            {/* Documents */}
            {summary.documentsRequired.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={12} className="text-amber-400" />
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.documentsRequired}</label>
                </div>
                <ul className="space-y-1">
                  {summary.documentsRequired.map((d, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-amber-400" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            {summary.nextSteps.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <ChevronRight size={12} className="text-blue-400" />
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.nextSteps}</label>
                </div>
                <ol className="space-y-1">
                  {summary.nextSteps.map((s, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-1.5">
                      <span className="text-blue-400 font-bold">{i + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copyExport}
            className="flex-1 py-3 glass-dark border border-slate-700/50 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:border-blue-500/50 transition-all"
          >
            <Copy size={16} /> {t.exportSummary}
          </button>
          <button
            onClick={onNewSession}
            className="flex-1 py-3 glow-btn rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <Landmark size={16} /> {t.newSession}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
const App = () => {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [interfaceLang, setInterfaceLang] = useState('en-US');
  const [myLang, setMyLang] = useState('en-US');
  const [targetLang, setTargetLang] = useState('mr-IN');
  const [role, setRole] = useState<'Banker' | 'Customer'>('Banker');

  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState('');
  const [copied, setCopied] = useState(false);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep track of the last sent message TIME to aggressively debounce Speech Recognition API's duplicate events
  const lastMsgTimeRef = useRef<number>(0);
  const lastSentMsgRef = useRef<string>('');

  // Prevent mic from hearing the speakers (Echo Loop)
  const isPlayingAudioRef = useRef(false);
  const recentTranslationsRef = useRef<Set<string>>(new Set());


  // Refs to avoid stale closures in socket callbacks
  const targetLangRef = useRef(targetLang);
  const roleRef = useRef(role);
  const roomIdRef = useRef(roomId);
  const myLangRef = useRef(myLang);
  useEffect(() => { targetLangRef.current = targetLang; }, [targetLang]);
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { myLangRef.current = myLang; }, [myLang]);

  // When my speaking language changes, or I join a room, sync it to others
  useEffect(() => {
    if (joined && roomId) {
      socket.emit('sync-language', roomId, myLang);
    }
  }, [myLang, joined, roomId]);

  // When I join initially, I ask others for their current states
  useEffect(() => {
    if (joined && roomId) {
      socket.emit('request-sync', roomId);
    }
  }, [joined, roomId]);

  // @ts-ignore
  const recognition = useRef<any>(null);

  // Initialize Speech Recognition once on mount
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      // Hardware-level blocker: If we are speaking, ignore the mic entirely
      if (isPlayingAudioRef.current) return;

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setTranscript(interimTranscript || finalTranscript);

      if (finalTranscript) {
        sendMessage(finalTranscript);
        setTranscript('');
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognition.current = rec;
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null); // track active TTS audio
  const t = UI_STRINGS[interfaceLang] || UI_STRINGS['en-US'];

  // Load voices on mount (Chrome/Edge loads async)
  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  // Pick the most natural-sounding voice for a language code
  const getBestVoice = (langCode: string): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    if (!voices.length) return null;
    // Priority 1: Google Neural voices (Chrome)
    const google = voices.find(v => v.lang.startsWith(langCode.split('-')[0]) && v.name.toLowerCase().includes('google'));
    if (google) return google;
    // Priority 2: Premium / Enhanced voices (macOS)
    const premium = voices.find(v => v.lang.startsWith(langCode.split('-')[0]) && (v.name.toLowerCase().includes('premium') || v.name.toLowerCase().includes('enhanced') || v.name.toLowerCase().includes('neural')));
    if (premium) return premium;
    // Priority 3: Exact language match
    const exact = voices.find(v => v.lang === langCode);
    if (exact) return exact;
    // Priority 4: Language prefix match
    const prefix = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    if (prefix) return prefix;
    // Priority 5: English fallback (best sounding)
    return voices.find(v => v.lang.startsWith('en')) || null;
  };

  // ── Socket listeners: stable, never torn down ──
  useEffect(() => {
    socket.on('receive-translation', (data: Message) => {
      setMessages(prev => {
        // If we find an existing local message with the same text, update it with the translation
        const existingIdx = prev.findIndex(m =>
          m.senderId === data.senderId &&
          m.originalText === data.originalText &&
          m.translatedText === 'Translating...'
        );

        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = data;
          return updated;
        }

        // Otherwise append as a new message
        return [...prev, data];
      });

      // Blacklist this translation from being re-heard by the mic for 8 seconds
      const lower = data.translatedText.toLowerCase().trim();
      recentTranslationsRef.current.add(lower);
      setTimeout(() => recentTranslationsRef.current.delete(lower), 8000);
    });

    // Receives Google TTS audio as base64 from server — play AND store for replay
    socket.on('tts-audio', ({ senderId, ttsAudio }: { senderId: string; ttsAudio: string }) => {
      // CRITICAL FIX: NEVER play your own TTS audio. 
      // If the sender plays their own voice, their MIC will hear it and start an INFINITE translation loop.
      if (senderId === socket.id) return;

      // Store audio in the latest message from this sender for replay
      setMessages(prev => {
        const idx = [...prev].reverse().findIndex(m => m.senderId === senderId);
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const updated = [...prev];
        updated[realIdx] = { ...updated[realIdx], ttsAudio };
        return updated;
      });

      // Stop previous audio before playing new (prevent collision!)
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
        currentAudioRef.current = null;
      }

      const playAudio = () => {
        // Stop the microphone immediately so it doesn't hear the speaker output
        if (isListening) {
          try { recognition.current?.stop(); } catch (e) { }
        }

        const audio = new Audio(ttsAudio);
        currentAudioRef.current = audio;
        isPlayingAudioRef.current = true;

        audio.onended = () => {
          currentAudioRef.current = null;
          isPlayingAudioRef.current = false;
          // Restart microphone only after the audio has finished playing
          if (isListening) {
            try { recognition.current?.start(); } catch (e) { }
          }
        };
        audio.onerror = (e) => {
          currentAudioRef.current = null;
          isPlayingAudioRef.current = false;
          if (isListening) {
            try { recognition.current?.start(); } catch (e) { }
          }
          console.warn('TTS audio play failed:', e);
        };
        audio.play().catch(err => {
          isPlayingAudioRef.current = false;
          if (isListening) {
            try { recognition.current?.start(); } catch (e) { }
          }
          console.warn('TTS play blocked:', err)
        });
      };

      playAudio();
    });

    // Gemini deep analysis arrives async — update the latest message from that sender
    socket.on('intent-update', (data: any) => {
      const { senderId, intent, subIntent, confidence, isAmbiguous, clarifyingQuestion,
        keyEntities, knowledgeBase, fraudRisk, customerProtection, guidance, urgency, termExplanations } = data;
      setMessages(prev => {
        const idx = [...prev].reverse().findIndex(m => m.senderId === senderId);
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const updated = [...prev];
        updated[realIdx] = {
          ...updated[realIdx],
          intent, confidence, keyEntities, knowledgeBase,
          // Rich fields stored directly on message
          ...(subIntent !== undefined && { subIntent }),
          ...(isAmbiguous !== undefined && { isAmbiguous }),
          ...(clarifyingQuestion && { clarifyingQuestion }),
          ...(fraudRisk && { fraudRisk }),
          ...(customerProtection && { customerProtection }),
          ...(guidance && { guidance }),
          ...(urgency && { urgency }),
          ...(termExplanations && { termExplanations }),
        } as any;
        return updated;
      });
    });

    socket.on('session-summary', (data: Summary) => {
      setSummary(data);
      setGeneratingSummary(false);
    });

    socket.on('partner-language-changed', ({ newLang, senderId }) => {
      if (senderId === socket.id) return;
      setTargetLang(newLang);
    });

    socket.on('please-sync', () => {
      if (roomIdRef.current && myLangRef.current) {
        socket.emit('sync-language', roomIdRef.current, myLangRef.current);
      }
    });

    socket.on('translation-error', ({ message }: { message: string }) => {
      console.error('BankBridge error:', message);
      setGeneratingSummary(false);
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(null), 4000);
    });

    return () => {
      socket.off('receive-translation');
      socket.off('tts-audio');
      socket.off('intent-update');
      socket.off('session-summary');
      socket.off('partner-language-changed');
      socket.off('please-sync');
      socket.off('translation-error');
    };
  }, []); // ← empty deps: runs once, listeners always active

  // ── Manual microphone control ──
  useEffect(() => {
    if (isListening) {
      setTranscript('');
      try {
        recognition.current.lang = myLangRef.current;
        recognition.current.start();
      } catch (e) { console.warn('Mic already active or error starting:', e); }
    } else {
      try { recognition.current?.stop(); } catch (e) { }
    }
  }, [isListening]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, transcript]);

  const startMeeting = () => {
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newId);
    socket.emit('join-room', newId);
    setJoined(true);
  };

  const joinMeeting = () => {
    if (roomId && roomId.trim()) {
      socket.emit('join-room', roomId.trim());
      setJoined(true);
    }
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Chrome Web Speech API aggressively fires `isFinal` multiple times rapidly.
    // We block the message ONLY if it is exactly identical AND occurred within 2.5 seconds.
    const now = Date.now();
    const lower = trimmed.toLowerCase();

    // 1. Debounce exact duplicates (Chrome double-firing)
    if (lower === lastSentMsgRef.current && now - lastMsgTimeRef.current < 2500) {
      console.log('Skipping exact duplicate event');
      return;
    }

    // 2. Global Echo Blocker: Never send a message that was recently played out by the speaker
    if (recentTranslationsRef.current.has(lower)) {
      console.log('Echo Blocker: Preventing microphone from echoing a translation');
      return;
    }

    lastSentMsgRef.current = lower;
    lastMsgTimeRef.current = now;

    // LOCAL UI OPTIMISTIC UPDATE: Add the message to our own list immediately
    // to show the user it was sent, but mark it so we don't translate it again if it bounces back.
    const localMsg: Message = {
      senderId: socket.id || 'me',
      senderRole: roleRef.current || 'unknown',
      originalText: trimmed,
      translatedText: 'Translating...',
      targetLang: targetLangRef.current || 'en-US',
      intent: 'General',
      confidence: 0,
      keyEntities: [],
      knowledgeBase: null,
    };
    setMessages(prev => [...prev, localMsg]);

    const targetLangName = LANGUAGES.find(l => l.code === targetLangRef.current)?.name || 'English';
    // Pass last 6 messages as conversation history for Gemini context
    const history = messages.slice(-6).map(m => ({
      senderRole: m.senderRole,
      originalText: m.originalText,
    }));
    socket.emit('send-message', {
      roomId: roomIdRef.current || '',
      text: trimmed,
      fromLang: LANGUAGES.find(l => l.code === myLangRef.current)?.name || 'English',
      targetLang: targetLangName,
      context: `${roleRef.current || 'User'} speaking to a ${roleRef.current === 'Banker' ? 'Customer' : 'Banker'} in a bank branch`,
      senderRole: roleRef.current || 'unknown',
      conversationHistory: history,
    });
  };

  const endSession = () => {
    if (messages.length === 0) { window.location.reload(); return; }
    setGeneratingSummary(true);
    const customerLang = LANGUAGES.find(l => l.code === (role === 'Banker' ? targetLang : myLang))?.name || 'Marathi';
    const staffLang = LANGUAGES.find(l => l.code === (role === 'Banker' ? myLang : targetLang))?.name || 'English';
    socket.emit('generate-summary', {
      roomId,
      conversation: messages,
      customerLang,
      targetLang: staffLang,
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Show Summary Screen ──
  if (summary) {
    return <SummaryScreen summary={summary} t={t} onNewSession={() => window.location.reload()} />;
  }

  // ── Error Toast ──
  const ErrorToast = errorMsg ? (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-5 py-3 rounded-2xl text-sm font-semibold shadow-xl flex items-center gap-2">
      <AlertCircle size={16} /> {errorMsg}
    </div>
  ) : null;

  // ── Show Generating Summary ──
  if (generatingSummary) {
    return (
      <>
        {ErrorToast}
        <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center gap-4 text-slate-400">
          <div className="w-12 h-12 border-2 border-t-indigo-500 border-slate-700 rounded-full animate-spin" />
          <p className="font-medium">{t.generatingSummary}</p>
        </div>
      </>
    );
  }

  // ── Setup Screen (Before joining) ──
  if (!joined) {
    return (
      <>
        {ErrorToast}
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass p-8 w-full max-w-2xl space-y-8 relative z-10"
          >
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-blue-500/10 rounded-2xl mb-2">
                <Landmark className="w-8 h-8 text-blue-400" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight gradient-text">{t.title}</h1>
              <p className="text-slate-400 text-base">{t.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column – Settings */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{t.interfaceLang}</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['en-US', 'hi-IN', 'mr-IN'].map(lang => (
                      <button key={lang} onClick={() => setInterfaceLang(lang)}
                        className={`p-2 rounded-xl text-sm font-medium transition-all ${interfaceLang === lang ? 'bg-blue-600' : 'bg-slate-800/50 hover:bg-slate-800'}`}>
                        {LANGUAGES.find(l => l.code === lang)?.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{t.speakingLang}</label>
                  <select value={myLang} onChange={e => setMyLang(e.target.value)}
                    className="w-full mt-2 bg-slate-800/50 border border-slate-700 p-3 rounded-xl outline-none focus:border-blue-500 transition-colors">
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label} ({l.name})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{t.userRole}</label>
                  <div className="flex gap-2 mt-2">
                    {(['Banker', 'Customer'] as const).map(r => (
                      <button key={r} onClick={() => setRole(r)}
                        className={`flex-1 p-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${role === r ? 'bg-indigo-600 ring-2 ring-indigo-400/20' : 'bg-slate-800/50 border border-slate-700'}`}>
                        {r === 'Banker' ? <ShieldCheck size={18} /> : <Users size={18} />}
                        {r === 'Banker' ? t.banker : t.client}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column – Join/Create */}
              <div className="flex flex-col justify-center space-y-4 border-l border-slate-800/50 pl-6">
                <button onClick={startMeeting} className="w-full py-4 glow-btn rounded-2xl font-bold flex items-center justify-center gap-2 group text-white">
                  {t.createRoom}
                  <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-800" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0f172a] px-2 text-slate-500">Or</span></div>
                </div>
                <div className="space-y-3">
                  <input type="text" value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())}
                    placeholder={t.roomCode}
                    className="w-full bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-center text-xl font-mono focus:border-blue-500 outline-none transition-all uppercase" />
                  <button onClick={joinMeeting} disabled={!roomId}
                    className="w-full py-4 bg-slate-100 text-slate-950 rounded-2xl font-bold hover:bg-white transition-colors disabled:opacity-40">
                    {t.join}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // ── Main Conversation Screen ──
  return (
    <>
      {ErrorToast}
      <div className="min-h-screen w-full flex flex-col bg-[#050810] text-slate-200">
        {/* Header */}
        <header className="h-16 flex justify-between items-center px-6 border-b border-slate-800/50 bg-[#050810]/90 backdrop-blur-md sticky top-0 z-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Landmark size={20} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h2 className="font-bold leading-tight">{t.title}</h2>
              <div className="flex items-center gap-1.5 cursor-pointer group" onClick={copyToClipboard}>
                <span className="text-[10px] font-mono text-slate-500 group-hover:text-blue-400 transition-colors uppercase tracking-widest">{roomId}</span>
                {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-slate-600 group-hover:text-blue-400" />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-700/50">
              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{t.speakingLang}</label>
                <select value={myLang} onChange={e => setMyLang(e.target.value)}
                  className="bg-transparent text-xs font-medium outline-none appearance-none">
                  {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#0f172a]">{l.label}</option>)}
                </select>
              </div>
              <ChevronDown size={12} className="text-slate-600" />
              <div className="w-px h-6 bg-slate-700" />
              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{t.targetLang}</label>
                <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
                  className="bg-transparent text-xs font-medium outline-none appearance-none">
                  {LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-[#0f172a]">{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 rounded-xl border border-indigo-500/20">
              {role === 'Banker' ? <ShieldCheck size={14} className="text-indigo-400" /> : <Users size={14} className="text-indigo-400" />}
              <span className="text-xs font-semibold text-indigo-300">{role === 'Banker' ? t.banker : t.client}</span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={endSession}
                className="px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition-all flex items-center gap-1.5">
                <FileText size={14} /> {t.endSession}
              </button>
              <button onClick={() => window.location.reload()}
                className="p-2 bg-slate-800/50 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all border border-slate-700/50">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <main className="flex-1 flex flex-col overflow-hidden p-4 md:p-6">
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-2 custom-scrollbar pb-4">
              {messages.length === 0 && !transcript && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-25">
                  <div className="w-16 h-16 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center">
                    <Mic size={28} />
                  </div>
                  <p className="max-w-xs text-sm">{t.holdToTalk}</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`flex ${msg.senderId === socket.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] md:max-w-md p-4 rounded-2xl shadow-md ${msg.senderId === socket.id
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'glass-dark bg-slate-800/30 rounded-tl-none border border-slate-700/50'}`}>
                      <div className="flex items-center gap-2 mb-1.5 opacity-60">
                        <span className="text-[9px] font-bold uppercase tracking-widest">
                          {msg.senderId === socket.id ? (role === 'Banker' ? t.banker : t.client) : (role === 'Banker' ? t.client : t.banker)}
                        </span>
                        {msg.intent && msg.intent !== 'General' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-white/10 rounded-full">{msg.intent}</span>
                        )}
                        <div className="h-1 w-1 bg-current rounded-full ml-auto" />
                        <span className="text-[9px]">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {msg.senderId === socket.id ? (
                        // SENDER: show what THEY said prominently, translation is small italic below
                        <>
                          <p className="text-base font-medium leading-relaxed">{msg.originalText}</p>
                          <div className="flex items-center gap-1 mt-1.5 opacity-70">
                            <span className="text-[9px] uppercase tracking-wider">→ translated:</span>
                          </div>
                          <p className="text-xs italic opacity-70">{msg.translatedText}</p>
                        </>
                      ) : (
                        // RECEIVER: show the TRANSLATION prominently, original small italic above
                        <>
                          <p className={`text-[10px] mb-1 italic text-slate-500`}>{msg.originalText}</p>
                          <p className="text-base font-medium leading-relaxed">{msg.translatedText}</p>
                        </>
                      )}
                      {/* Replay button */}
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => {
                            if (msg.ttsAudio) {
                              new Audio(msg.ttsAudio).play().catch(() => { });
                            } else {
                              // Fallback: browser TTS
                              const langCode = LANGUAGES.find(l => l.name === msg.targetLang)?.code || 'en-US';
                              const utter = new SpeechSynthesisUtterance(msg.translatedText);
                              const best = getBestVoice(langCode);
                              if (best) utter.voice = best;
                              utter.lang = langCode;
                              utter.rate = 0.9;
                              window.speechSynthesis.speak(utter);
                            }
                          }}
                          className="p-1 rounded-full opacity-50 hover:opacity-100 transition-all hover:bg-white/10"
                          title="Replay audio"
                        >
                          <Volume2 size={13} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {transcript && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                    <div className="bg-blue-600/20 border border-blue-500/30 px-4 py-3 rounded-2xl rounded-tr-none max-w-md">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Mic size={13} className="text-blue-400" />
                          <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-30" />
                        </div>
                        <span className="text-sm italic text-blue-300">{transcript}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* PTT Button */}
            <div className="pt-4 pb-2 flex flex-col items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div className={`w-2 h-2 rounded-full transition-all ${isListening ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-slate-700'}`} />
                <Clock size={10} />
                {isListening ? t.listening : 'Ready'}
              </div>
              <button
                onMouseDown={() => {
                  setIsListening(true);
                }}
                onMouseUp={() => {
                  setIsListening(false);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setIsListening(true);
                }}
                onTouchEnd={() => {
                  setIsListening(false);
                }}
                className={`h-20 w-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative ${isListening ? 'pulse-red scale-110' : 'bg-slate-800 hover:bg-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.5)]'}`}
              >
                {isListening ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-blue-400" />}
                <div className={`absolute -inset-2 rounded-full border-2 border-blue-500/20 transition-all ${isListening ? 'opacity-100 scale-125' : 'opacity-0'}`} />
                <div className={`absolute -inset-4 rounded-full border border-blue-500/10 transition-all ${isListening ? 'opacity-100 scale-150' : 'opacity-0'}`} />
              </button>
              <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">
                {isListening ? t.releaseToSend : t.holdToTalk}
              </p>
            </div>
          </main>

          {/* Universal Insight Sidebar */}
          <aside className="hidden lg:flex w-80 border-l border-slate-800/50 p-4 overflow-y-auto custom-scrollbar flex-shrink-0">
            <InsightSidebar messages={messages} t={t} role={role} />
          </aside>
        </div>

        <footer className="h-10 border-t border-slate-800/50 flex items-center justify-center px-8 text-[9px] text-slate-700 uppercase tracking-widest font-bold flex-shrink-0">
          BankBridge • {role} Portal • Powered by Gemini AI • Secure Encrypted Session
        </footer>
      </div>
    </>
  );
};

export default App;
