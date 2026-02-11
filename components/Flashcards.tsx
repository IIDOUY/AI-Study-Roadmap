
import React, { useState, useEffect, useRef } from 'react';
import { FlashcardSet } from '../types';
import { generateFlashcards, askFlashcardQuestion, GenerationInput } from '../services/geminiService';
import { fetchFlashcardSets, createFlashcardSet, deleteFlashcardSet } from '../services/flashcardService';
import { 
  ArrowLeft, Plus, Loader2, Trash2, RotateCw, ChevronLeft, ChevronRight, 
  BrainCircuit, Layers, X, Sparkles, BookOpen,
  FileText, Image as ImageIcon, Youtube, AlignLeft, Upload, Command, ArrowRight, ArrowUp, Copy
} from 'lucide-react';

interface FlashcardsProps {
  onBack: () => void;
  apiKey: string;
}

const Flashcards: React.FC<FlashcardsProps> = ({ onBack, apiKey }) => {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [activeSet, setActiveSet] = useState<FlashcardSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // View State
  const [isCreating, setIsCreating] = useState(false);
  
  // Creation Input State
  type Tab = 'pdf' | 'text' | 'image' | 'youtube';
  const [activeTab, setActiveTab] = useState<Tab>('pdf');
  const [dragActive, setDragActive] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Player State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Ask AI State
  const [askMode, setAskMode] = useState(false);
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Ref to track navigation state and prevent rapid-fire triggering
  const isNavigating = useRef(false);

  useEffect(() => {
    loadSets();
  }, []);

  // Keyboard Navigation Effect
  useEffect(() => {
    if (!activeSet) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent rapid inputs
      if (isNavigating.current) return;
      if (askMode) return; // Disable keyboard nav while typing question

      if (e.key === 'ArrowRight') {
        if (currentCardIndex < activeSet.cards.length - 1) {
           handleNavigation('next');
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentCardIndex > 0) {
           handleNavigation('prev');
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === 'Escape') {
        if (askMode) setAskMode(false);
        if (aiAnswer) setAiAnswer(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSet, currentCardIndex, askMode, aiAnswer]);

  // Reset Ask AI state when card changes
  useEffect(() => {
      setAskMode(false);
      setQuestion("");
      setAiAnswer(null);
  }, [currentCardIndex, activeSet]);

  // Focus input on ask mode
  useEffect(() => {
      if (askMode && inputRef.current) {
          // Small delay to allow transition to start rendering input
          setTimeout(() => inputRef.current?.focus(), 50);
      }
  }, [askMode]);

  const loadSets = async () => {
    setLoading(true);
    try {
      const data = await fetchFlashcardSets();
      setSets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetCreationState = () => {
      setTextInput("");
      setYoutubeUrl("");
      setSelectedFile(null);
      setActiveTab('pdf');
  };

  // Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };
  
  const validateAndSetFile = (file: File) => {
    if (activeTab === 'pdf' && file.type === "application/pdf") {
        setSelectedFile(file);
    } else if (activeTab === 'image' && file.type.startsWith("image/")) {
        setSelectedFile(file);
    } else {
        alert(`Please upload a valid ${activeTab === 'pdf' ? 'PDF' : 'Image'} file.`);
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      alert("Please configure your API Key in Settings first.");
      return;
    }

    let input: GenerationInput | null = null;

    if (activeTab === 'pdf' || activeTab === 'image') {
        if (selectedFile) input = { type: 'file', file: selectedFile };
    } else if (activeTab === 'text') {
        if (textInput.trim()) input = { type: 'text', text: textInput };
    } else if (activeTab === 'youtube') {
        if (youtubeUrl.trim()) input = { type: 'youtube', url: youtubeUrl };
    }

    if (!input) return;

    setGenerating(true);
    try {
      const generated = await generateFlashcards(input, apiKey);
      const newSet = await createFlashcardSet(generated);
      setSets([newSet, ...sets]);
      
      resetCreationState();
      setIsCreating(false);
      
      setActiveSet(newSet); // Auto-start
      setCurrentCardIndex(0);
      setIsFlipped(false);
    } catch (e) {
      console.error(e);
      alert("Failed to generate flashcards. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this flashcard set?")) {
      await deleteFlashcardSet(id);
      setSets(sets.filter(s => s.id !== id));
    }
  };

  const handlePlay = (set: FlashcardSet) => {
    setActiveSet(set);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    isNavigating.current = false;
  };

  const handleNavigation = (direction: 'next' | 'prev') => {
     if (isNavigating.current || !activeSet) return;
     
     isNavigating.current = true;
     setIsFlipped(false);
     
     setTimeout(() => {
        setCurrentCardIndex(prev => {
            if (direction === 'next') {
                // Bounds check inside update
                return prev < activeSet.cards.length - 1 ? prev + 1 : prev;
            } else {
                return prev > 0 ? prev - 1 : prev;
            }
        });
        isNavigating.current = false;
     }, 150);
  };

  const nextCard = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeSet && currentCardIndex < activeSet.cards.length - 1) {
      handleNavigation('next');
    }
  };

  const prevCard = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentCardIndex > 0) {
      handleNavigation('prev');
    }
  };

  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !activeSet || !apiKey) return;

    setIsAsking(true);
    const currentCard = activeSet.cards[currentCardIndex];
    
    try {
        const answer = await askFlashcardQuestion(question, currentCard.front, currentCard.back, apiKey);
        setAiAnswer(answer);
        setQuestion(""); 
        setAskMode(false); // Close input to show answer clearly
    } catch (error) {
        setAiAnswer("Failed to get an answer.");
    } finally {
        setIsAsking(false);
    }
  };

  // --- FULL SCREEN CREATION VIEW (Replaces Modal) ---
  if (isCreating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in bg-gray-50 dark:bg-gray-950 absolute inset-0 z-50 overflow-y-auto">
        
        {/* Close Button / Back */}
        <div className="absolute top-4 left-4 z-50">
            <button 
              onClick={() => { setIsCreating(false); resetCreationState(); }}
              className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
        </div>

        <div className="w-full max-w-xl text-center mb-10 mt-20">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
                Generate Flashcards
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
                Upload your syllabus, paste notes, or link a video. AI will create a study deck for you.
            </p>
        </div>

        <div className="w-full max-w-xl">
            {/* Tabs */}
            <div className="flex p-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl mb-6 relative z-30 shadow-sm">
                <button 
                    onClick={() => { setActiveTab('pdf'); setSelectedFile(null); }}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'pdf' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                    <FileText className="w-4 h-4" /> PDF
                </button>
                <button 
                    onClick={() => { setActiveTab('text'); setTextInput(""); }}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'text' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                    <AlignLeft className="w-4 h-4" /> Text
                </button>
                <button 
                    onClick={() => { setActiveTab('image'); setSelectedFile(null); }}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'image' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                    <ImageIcon className="w-4 h-4" /> Image
                </button>
                <button 
                    onClick={() => { setActiveTab('youtube'); setYoutubeUrl(""); }}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'youtube' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                    <Youtube className="w-4 h-4" /> Video
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-2 shadow-sm overflow-hidden min-h-[320px] flex flex-col relative z-20">
                
                {/* PDF & Image Dropzone */}
                {(activeTab === 'pdf' || activeTab === 'image') && (
                    <div 
                        className={`
                            relative flex-1 rounded-2xl border-2 border-dashed m-4 flex flex-col items-center justify-center text-center transition-all duration-200 p-8
                            ${dragActive ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"}
                            ${generating ? "cursor-wait opacity-80" : "cursor-pointer"}
                            ${selectedFile ? "bg-gray-50 dark:bg-gray-800/50 border-solid border-gray-300 dark:border-gray-600" : ""}
                        `}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => !selectedFile && document.getElementById('file-upload-input')?.click()}
                    >
                        <input 
                            id="file-upload-input"
                            type="file" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                            accept={activeTab === 'pdf' ? "application/pdf" : "image/*"}
                            onChange={handleFileChange}
                            disabled={generating}
                        />
                        
                        {selectedFile ? (
                            <div className="flex flex-col items-center animate-fade-in z-20 relative pointer-events-none">
                                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                                    {activeTab === 'pdf' ? <FileText className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
                                </div>
                                <p className="font-bold text-gray-900 dark:text-white text-lg truncate max-w-[250px]">{selectedFile.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                
                                {generating ? (
                                     <div className="flex flex-col items-center">
                                         <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                                         <p className="text-sm font-medium text-indigo-600">Generating Flashcards...</p>
                                     </div>
                                ) : (
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            // Small timeout to prevent the input click from triggering immediately after
                                            setTimeout(() => setSelectedFile(null), 10); 
                                        }}
                                        className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors pointer-events-auto"
                                    >
                                        Remove File
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center space-y-5 pointer-events-none">
                                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:scale-110 transition-transform">
                                    {generating ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                                </div>
                                
                                <div className="space-y-1">
                                    <p className="font-bold text-gray-900 dark:text-white text-lg">
                                        {generating ? "Analyzing content..." : `Upload ${activeTab === 'pdf' ? 'PDF' : 'Image'}`}
                                    </p>
                                    {!generating && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                            {activeTab === 'pdf' ? "Drop your study material here" : "Screenshots, diagrams, or notes"}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Only show the Generate button for File inputs if file is selected and NOT generating */}
                        {selectedFile && !generating && (
                             <div className="absolute bottom-8 left-0 right-0 flex justify-center z-30 pointer-events-auto">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                                    className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4" /> Generate Deck
                                </button>
                             </div>
                        )}
                    </div>
                )}

                {/* Text Input */}
                {activeTab === 'text' && (
                    <div className="flex-1 flex flex-col p-4">
                        <textarea 
                            className="flex-1 w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-sm font-medium focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none resize-none dark:text-white transition-all"
                            placeholder="Paste your notes, topic list, or paragraphs here..."
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            disabled={generating}
                        />
                        <div className="mt-4 flex justify-end">
                            <button 
                                type="button"
                                onClick={handleGenerate}
                                disabled={!textInput.trim() || generating}
                                className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Generate Deck <ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* YouTube Input */}
                {activeTab === 'youtube' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="w-full max-w-md space-y-5">
                            <div className="text-center mb-4">
                                <div className="w-14 h-14 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 dark:border-red-900/30">
                                    <Youtube className="w-7 h-7" />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg">YouTube to Flashcards</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Paste a video link to generate flashcards based on its topic.</p>
                            </div>

                            <input 
                                type="text" 
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none dark:text-white transition-all"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                disabled={generating}
                            />

                            <button 
                                type="button"
                                onClick={handleGenerate}
                                disabled={!youtubeUrl.trim() || generating}
                                className="w-full py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Generate Deck <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </div>
                    </div>
                )}

            </div>
            
        </div>
      </div>
    );
  }

  // --- PLAYER VIEW ---
  if (activeSet) {
    // Safety check: Ensure index is always valid to prevent crashes
    // If rapid navigation pushed index out of bounds, clamp it here for render
    const safeIndex = Math.min(Math.max(0, currentCardIndex), activeSet.cards.length - 1);
    const currentCard = activeSet.cards[safeIndex];
    
    // Fallback if cards array is empty or corrupt
    if (!currentCard) {
        return (
             <div className="flex flex-col h-full bg-[#FAFAFA] dark:bg-gray-950 font-sans items-center justify-center">
                <p>No cards available.</p>
                <button onClick={() => setActiveSet(null)} className="mt-4 text-blue-500">Back</button>
             </div>
        );
    }

    const progress = Math.round(((safeIndex + 1) / activeSet.cards.length) * 100);

    return (
      <div className="flex flex-col h-full bg-[#FAFAFA] dark:bg-gray-950 font-sans relative">
        {/* Player Header */}
        <div className="h-16 px-6 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 z-20 relative">
           <button onClick={() => setActiveSet(null)} className="flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium text-sm">Back to Library</span>
           </button>
           <h2 className="font-bold text-gray-900 dark:text-white">{activeSet.title}</h2>
           <div className="w-20"></div> {/* Spacer for centering */}
        </div>

        {/* Player Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
           {/* Progress Bar */}
           <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800">
              <div className="h-full bg-black dark:bg-white transition-all duration-300" style={{ width: `${progress}%` }}></div>
           </div>

           <div className="mb-8 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Card {safeIndex + 1} / {activeSet.cards.length}
           </div>

           {/* The Card Container */}
           <div 
             className="w-full max-w-2xl aspect-[3/2] sm:aspect-[16/9] perspective-1000 cursor-pointer group mb-4"
             onClick={() => setIsFlipped(!isFlipped)}
           >
              <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                 
                 {/* Front Side - Minimalist White */}
                 <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-900 rounded-3xl border-2 border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center p-12 text-center hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                    <span className="absolute top-8 left-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Question</span>
                    <h3 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
                       {currentCard.front}
                    </h3>
                    <div className="absolute bottom-8 flex items-center gap-2 text-gray-400 text-xs font-medium opacity-50">
                       <RotateCw className="w-3 h-3" /> Click to flip (Space)
                    </div>
                 </div>

                 {/* Back Side - High Contrast Black */}
                 <div className="absolute inset-0 backface-hidden rotate-y-180 bg-black dark:bg-white rounded-3xl flex flex-col items-center justify-center p-12 text-center">
                    <span className="absolute top-8 left-8 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Answer</span>
                    <p className="text-xl sm:text-2xl font-medium text-white dark:text-black leading-relaxed">
                       {currentCard.back}
                    </p>
                 </div>
              </div>
           </div>

           {/* Answer Display - Overlay */}
           {aiAnswer && (
              <div className="absolute bottom-24 sm:bottom-32 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-[100]">
                  <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-indigo-100 dark:border-indigo-500/30 p-5 rounded-3xl shadow-2xl animate-in slide-in-from-bottom-5 fade-in zoom-in-95 duration-300 relative overflow-hidden">
                      
                      <div className="flex flex-col gap-2 relative">
                              <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Answer</h4>
                                  <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => {
                                            if (aiAnswer) navigator.clipboard.writeText(aiAnswer.replace(/\*/g, ''));
                                        }}
                                        className="text-xs font-medium text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
                                      >
                                          <Copy className="w-3 h-3" /> Copy
                                      </button>
                                      <button 
                                        onClick={() => setAiAnswer(null)}
                                        className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-100 dark:bg-gray-800 p-1 rounded-full"
                                      >
                                         <X className="w-3.5 h-3.5" />
                                      </button>
                                  </div>
                              </div>
                              <div className="text-sm text-gray-900 dark:text-white leading-relaxed max-h-[40vh] overflow-y-auto pr-2 whitespace-pre-line font-medium scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                                  {aiAnswer.replace(/\*/g, '')}
                              </div>
                      </div>
                  </div>
              </div>
           )}

           {/* Controls Container - Fixed at bottom area */}
           <div className="relative mt-8 w-full max-w-3xl mx-auto h-16 flex items-center justify-center z-[90]">
              
              {/* Previous Button */}
              <button 
                onClick={prevCard}
                disabled={safeIndex === 0 || askMode}
                className={`
                    absolute left-4 p-4 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 
                    text-gray-900 dark:text-white transition-all duration-300 shadow-sm
                    ${askMode ? 'opacity-0 translate-x-10 scale-75 pointer-events-none' : 'opacity-100 translate-x-0 scale-100 hover:bg-gray-100 dark:hover:bg-gray-800'}
                    disabled:opacity-30 disabled:cursor-not-allowed
                `}
                title="Previous Card"
              >
                 <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Center Action (Flip / Ask) */}
              <div className={`
                  relative h-14 transition-all duration-500 ease-out flex items-center z-50
                  ${askMode ? 'w-full max-w-2xl px-4' : 'w-48'}
              `}>
                  {!askMode ? (
                      <button 
                         onClick={() => setAskMode(true)}
                         className="w-full h-full rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105 transition-all flex items-center justify-center gap-2"
                      >
                         <Sparkles className="w-4 h-4" /> Ask AI
                      </button>
                  ) : (
                      <form 
                        onSubmit={handleAskSubmit} 
                        className="w-full h-full relative flex items-center"
                      >
                          <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-500 shadow-2xl flex items-center overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                             <input 
                                ref={inputRef}
                                type="text" 
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                className="flex-1 h-full pl-5 pr-24 bg-transparent outline-none text-base font-medium text-gray-900 dark:text-white placeholder-gray-400"
                                placeholder="Ask a question about this card..."
                                disabled={isAsking}
                                onKeyDown={(e) => {
                                    if(e.key === 'Escape') {
                                        setAskMode(false);
                                        setQuestion("");
                                    }
                                }}
                             />
                             
                             <div className="absolute right-2 flex items-center gap-1">
                                 <button 
                                    type="button"
                                    onClick={() => { setAskMode(false); setQuestion(""); }}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                    title="Cancel"
                                 >
                                    <X className="w-5 h-5" />
                                 </button>
                                 <button 
                                    type="submit"
                                    disabled={!question.trim() || isAsking}
                                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-sm"
                                    title="Send Question"
                                 >
                                    {isAsking ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                                 </button>
                             </div>
                          </div>
                      </form>
                  )}
              </div>

              {/* Next Button */}
              <button 
                onClick={nextCard}
                disabled={safeIndex === activeSet.cards.length - 1 || askMode}
                className={`
                    absolute right-4 p-4 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 
                    text-gray-900 dark:text-white transition-all duration-300 shadow-sm
                    ${askMode ? 'opacity-0 -translate-x-10 scale-75 pointer-events-none' : 'opacity-100 translate-x-0 scale-100 hover:bg-gray-100 dark:hover:bg-gray-800'}
                    disabled:opacity-30 disabled:cursor-not-allowed
                `}
                title="Next Card"
              >
                 <ChevronRight className="w-6 h-6" />
              </button>

           </div>
        </div>

        {/* Global Styles for 3D flip */}
        <style>{`
          .perspective-1000 { perspective: 1000px; }
          .transform-style-3d { transform-style: preserve-3d; }
          .backface-hidden { backface-visibility: hidden; }
          .rotate-y-180 { transform: rotateY(180deg); }
        `}</style>
      </div>
    );
  }

  // --- LIBRARY VIEW ---
  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] dark:bg-gray-950 font-sans">
      
      {/* Header */}
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 shrink-0">
         <div onClick={onBack} className="flex items-center gap-2 cursor-pointer text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium text-sm">Dashboard</span>
         </div>
         <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium text-sm transition-colors"
         >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Set</span>
         </button>
      </header>

      {/* Library Grid */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8">
         {loading ? (
             <div className="flex items-center justify-center h-64">
                 <Loader2 className="w-8 h-8 text-gray-900 dark:text-white animate-spin" />
             </div>
         ) : sets.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
                 <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400 mb-6">
                     <Layers className="w-8 h-8" />
                 </div>
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No flashcards yet</h2>
                 <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
                    Create your first deck by uploading a file or linking a video.
                 </p>
                 <button 
                    onClick={() => setIsCreating(true)}
                    className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm"
                 >
                    Create Deck
                 </button>
             </div>
         ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {sets.map(set => (
                     <div 
                        key={set.id} 
                        onClick={() => handlePlay(set)}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:border-black dark:hover:border-white transition-colors cursor-pointer group relative"
                     >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => handleDelete(set.id, e)}
                                className="p-2 text-gray-400 hover:text-red-500 rounded-md transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-900 dark:text-white mb-4">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 line-clamp-1">{set.title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium uppercase tracking-wide">{set.cards.length} cards</p>
                        
                        <div className="flex items-center text-gray-900 dark:text-white text-sm font-bold mt-auto">
                            Study Now <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                        </div>
                     </div>
                 ))}
             </div>
         )}
      </div>
    </div>
  );
};

export default Flashcards;
