# 🏦 BankBridge — Real-Time AI Translation for Indian Bank Branches

> **Breaking the language barrier between bank staff and customers — instantly.**

---

## 💡 The Idea

India has 22 official languages and hundreds of dialects. Every day, millions of customers walk into bank branches unable to communicate with staff who speak a different language. A Marathi customer trying to open a savings account with a Hindi-speaking banker, a Tamil customer asking about home loans from a Gujarati teller — these conversations fail before they begin.

**BankBridge** solves this with real-time, bidirectional AI translation specifically trained for banking terminology. Two people speak in their own languages, and BankBridge translates instantly — with voice — so the conversation flows naturally.

---

## ✨ Key Features

- 🎙️ **Push-to-Talk Voice Input** — Speak naturally, no typing needed
- 🌐 **Real-Time Bidirectional Translation** — Google Translate for Indian languages (Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Bengali + English)
- 🔊 **Natural Google TTS Voice Output** — Translations are spoken aloud in the target language
- 🧠 **AI Intent Detection** — Gemini AI understands banking context ("muje ghar chahiye" → Home Loan)
- 🏦 **Banking Knowledge Base** — Automatically shows required documents and steps for detected intent
- 📋 **Session Summary** — AI-generated bilingual summary at end of session
- 🔁 **Replay Button** — Replay any message's audio anytime
- 📱 **Mobile Friendly** — Touch support for PTT button

---

## 🏗️ Architecture

```
┌─────────────────┐         WebSocket (Socket.IO)        ┌─────────────────┐
│   Banker Tab    │ ◄──────────────────────────────────► │  Customer Tab   │
│  (English)      │                                       │  (Marathi/Hindi)│
└────────┬────────┘                                       └────────┬────────┘
         │                                                         │
         └──────────────────┬──────────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Node.js Server│
                    │   (Port 3001)  │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────────┐
              ▼             ▼                  ▼
    ┌──────────────┐  ┌──────────┐   ┌──────────────────┐
    │   Google     │  │  Gemini  │   │   Google TTS     │
    │  Translate   │  │   AI     │   │  (Natural Voice) │
    │ (Accurate    │  │ (Intent  │   │  Server-side     │
    │  Translation)│  │Detection)│   │  Base64 Audio    │
    └──────────────┘  └──────────┘   └──────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS v3 + Framer Motion |
| Real-time | Socket.IO |
| Backend | Node.js + Express |
| Translation | Google Translate (via `@vitalets/google-translate-api`) |
| AI Intent | Gemini 2.0 Flash Lite (`@google/generative-ai`) |
| Text-to-Speech | Google TTS (via `google-tts-api`, fetched server-side) |
| Speech-to-Text | Web Speech API (browser-native) |
| LLM (Summary) | Ollama (`llama3.2` local) |

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js v18+
- [Ollama](https://ollama.ai) installed and running locally
- A Gemini API key ([get one free](https://aistudio.google.com))

### 1. Clone & Install

```bash
git clone <repo-url>
cd Hackathon

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Pull Ollama Model

```bash
ollama pull llama3.2
```

### 3. Configure Environment

Create `server/.env`:

```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### 4. Run

**Terminal 1 — Backend:**
```bash
cd server
node index.js
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

### 5. Open

Go to **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 📖 How to Use

1. **Banker opens** `localhost:5173` — selects **Banker** role, sets interface language to English, speaking language to English
2. **Customer opens** `localhost:5173` (another tab/device) — selects **Customer** role, sets speaking language to Marathi/Hindi/etc.
3. Both enter the **same Room Code** and click **Join**
4. **Hold the mic button** to speak — release to send
5. The other person **sees the translation** and **hears it spoken aloud** in their language
6. Banker sees **intent detection** in the sidebar (e.g., "Home Loan → Documents required: Aadhaar, PAN...")
7. Click **End Session** to generate a bilingual AI summary

---

## 🌍 Supported Languages

Hindi • Marathi • Gujarati • Tamil • Telugu • Kannada • Bengali • English

---

## 🎯 Problem Statement

Built for the challenge: *"How can AI bridge communication gaps in Indian financial services?"*

BankBridge targets:
- 🏦 Rural bank branches with multilingual customers
- 🤝 Financial inclusion for non-Hindi speaking regions
- 📱 Zero training required — works out of the box

---

## 👥 Team

Built with ❤️ for Hackathon 2026
