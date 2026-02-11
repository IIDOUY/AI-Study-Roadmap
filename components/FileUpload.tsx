import React, { useState } from 'react';
import { Upload, FileText, Loader2, Command, Image as ImageIcon, Youtube, AlignLeft, ArrowRight } from 'lucide-react';
import { GenerationInput } from '../services/geminiService';

interface FileUploadProps {
  onContentSubmit: (input: GenerationInput) => void;
  isProcessing: boolean;
}

type Tab = 'pdf' | 'text' | 'image' | 'youtube';

const FileUpload: React.FC<FileUploadProps> = ({ onContentSubmit, isProcessing }) => {
  const [activeTab, setActiveTab] = useState<Tab>('pdf');
  const [dragActive, setDragActive] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

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
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = (file: File) => {
    if (activeTab === 'pdf') {
        if (file.type === "application/pdf") {
            onContentSubmit({ type: 'file', file });
        } else {
            alert("Please upload a PDF file.");
        }
    } else if (activeTab === 'image') {
        if (file.type.startsWith("image/")) {
            onContentSubmit({ type: 'file', file });
        } else {
            alert("Please upload an image file (PNG, JPG, WEBP).");
        }
    }
  };

  const handleTextSubmit = () => {
      if (textInput.trim()) {
          onContentSubmit({ type: 'text', text: textInput });
      }
  };

  const handleYoutubeSubmit = () => {
      if (youtubeUrl.trim()) {
          onContentSubmit({ type: 'youtube', url: youtubeUrl });
      }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in bg-gray-50 dark:bg-gray-950">
      
      <div className="w-full max-w-xl text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm mb-6">
           <Command className="w-7 h-7 text-gray-900 dark:text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
          Create your study plan
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Upload your syllabus, paste notes, or link a video. AI will structure it into a roadmap.
        </p>
      </div>

      <div className="w-full max-w-xl">
        
        {/* Tabs */}
        <div className="flex p-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl mb-6 relative z-30 shadow-sm">
            <button 
                type="button"
                onClick={() => setActiveTab('pdf')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'pdf' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
            >
                <FileText className="w-4 h-4" /> PDF
            </button>
            <button 
                type="button"
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'text' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
            >
                <AlignLeft className="w-4 h-4" /> Text
            </button>
            <button 
                type="button"
                onClick={() => setActiveTab('image')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'image' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
            >
                <ImageIcon className="w-4 h-4" /> Image
            </button>
            <button 
                type="button"
                onClick={() => setActiveTab('youtube')}
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
                        ${isProcessing ? "cursor-wait opacity-80" : "cursor-pointer"}
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input 
                        type="file" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        accept={activeTab === 'pdf' ? "application/pdf" : "image/*"}
                        onChange={handleFileChange}
                        disabled={isProcessing}
                    />
                    
                    <div className="flex flex-col items-center justify-center space-y-5 pointer-events-none">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:scale-110 transition-transform">
                        {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : (activeTab === 'pdf' ? <Upload className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />)}
                        </div>
                        
                        <div className="space-y-1">
                        <p className="font-bold text-gray-900 dark:text-white text-lg">
                            {isProcessing ? "Analyzing content..." : `Upload ${activeTab === 'pdf' ? 'Syllabus PDF' : 'Study Image'}`}
                        </p>
                        {!isProcessing && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {activeTab === 'pdf' ? "Drop your course PDF here" : "Screenshots, diagrams, or notes"}
                            </p>
                        )}
                        </div>

                        {isProcessing && (
                        <div className="w-full max-w-[200px] h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-4">
                            <div className="h-full bg-gray-900 dark:bg-white animate-progress origin-left"></div>
                        </div>
                        )}
                    </div>
                </div>
            )}

            {/* Text Input */}
            {activeTab === 'text' && (
                <div className="flex-1 flex flex-col p-4">
                    <textarea 
                        className="flex-1 w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-sm font-medium focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none resize-none dark:text-white transition-all"
                        placeholder="Paste your syllabus, notes, or topic list here..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        disabled={isProcessing}
                    />
                    <div className="mt-4 flex justify-end">
                        <button 
                            type="button"
                            onClick={handleTextSubmit}
                            disabled={!textInput.trim() || isProcessing}
                            className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg"
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Generate Plan <ArrowRight className="w-4 h-4" /></>}
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
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg">YouTube Roadmap</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Paste a video link to generate a study path based on its topic.</p>
                        </div>

                        <input 
                            type="text" 
                            className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none dark:text-white transition-all"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            disabled={isProcessing}
                        />

                        <button 
                            type="button"
                            onClick={handleYoutubeSubmit}
                            disabled={!youtubeUrl.trim() || isProcessing}
                            className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Analyze Video <ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </div>
                </div>
            )}

        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
           <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
              <FileText className="w-6 h-6 text-gray-400 mb-2" />
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Auto-Structure</span>
           </div>
           <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
              <Command className="w-6 h-6 text-gray-400 mb-2" />
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Task Breakdown</span>
           </div>
           <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
              <Loader2 className="w-6 h-6 text-gray-400 mb-2" />
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Time Estimates</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;