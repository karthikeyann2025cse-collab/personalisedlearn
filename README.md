# 🎓 LearnOn — AI-Powered Personalized & Adaptive Learning Platform

LearnOn is a full-stack, AI-driven educational platform that empowers learners to upload study materials, chat with a citation-grounded AI tutor, take adaptive quizzes with SM-2 spaced repetition flashcards, trace prerequisite hierarchies, and detect knowledge gaps and misconceptions using Machine Learning.

---

## 🌟 Key Features

1. **Smart PDF & Notes Studio**:
   - Upload textbooks, lecture notes, or markdown files (`.pdf`, `.txt`, `.md`).
   - Chunking, automatic semantic indexing, executive study summaries, and side-by-side reading.

2. **Grounded AI Tutor**:
   - Multi-turn interactive chat grounded in your uploaded documents.
   - Exact source page citations and adaptive explanation levels based on mastery.

3. **Adaptive Quiz Studio**:
   - Generates Multiple Choice (MCQ), True/False, and Short/Long Answer practice questions.
   - Timed speed runs or untimed practice.
   - SM-2 Spaced Repetition flashcard review mode.
   - Automatically grades answers and updates topic mastery in real-time.

4. **Knowledge Gap & Misconception Detector**:
   - **Decision Tree Classifier**: Interpretable state categorization (`MASTERED`, `KNOWLEDGE_GAP`, `MISCONCEPTION`, `PREREQUISITE_BLOCKED`) with decision tree path tracing.
   - **Topic Dependency Graph (DAG)**: Recursive backward traversal to isolate root-cause prerequisite gaps, and forward traversal to predict downstream cascading risks.
   - **Rule-Based Cognitive Diagnosis**: Pedagogical rules pinpointing mental model inversions, speed-accuracy heuristic guessing, and cognitive stalls.

5. **ML Insights & Predictive Analytics**:
   - Linear Regression quiz score forecast simulator.
   - Random Forest struggle risk predictor.
   - Interactive study heatmaps, time distribution, and score trends.

---

## ⚡ Quick Start (Windows)

### 1. Launch the Backend
Double-click `run_backend.bat` or run:
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at: [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs)

### 2. Launch the Frontend
Double-click `run_frontend.bat` or run:
```powershell
cd frontend
npm run dev
```
Open in browser: **[http://localhost:5173](http://localhost:5173)**

---

## 📁 Project Structure

```text
learnon/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routes (auth, documents, chat, quiz, ml_api, analytics, planner)
│   │   ├── core/            # Config, JWT authentication, security
│   │   ├── db/              # SQLAlchemy models, SQLite database, async sessions, CRUD
│   │   ├── ml/              # Scikit-learn models (Decision Tree, Knowledge Gap Detector, Linear Regression, Random Forest, K-Means, Spaced Repetition)
│   │   ├── services/        # PDF extraction, RAG vector retrieval, quiz generator, analytics
│   │   └── main.py          # FastAPI application entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API client functions
│   │   ├── components/      # UI components, layout, and sidebar
│   │   ├── pages/           # Pages (Dashboard, Library, Reader, Chat, QuizStudio, KnowledgeMap, Insights, Analytics, Timer, Planner, Profile, Auth)
│   │   ├── store/           # Zustand state management
│   │   ├── types/           # TypeScript interfaces & types
│   │   └── App.tsx          # React Router configuration
│   ├── package.json
│   └── vite.config.ts
├── run_backend.bat          # 1-click backend launcher
├── run_frontend.bat         # 1-click frontend launcher
└── README.md
```
