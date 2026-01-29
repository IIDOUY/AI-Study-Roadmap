import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';
import ApiKeyModal from './components/ApiKeyModal';
import PaymentModal from './components/PaymentModal';
import Toast from './components/Toast';
import { Roadmap, AppState } from './types';
import { generateRoadmap, GenerationInput } from './services/geminiService';
import { fetchRoadmaps, createRoadmap, updateRoadmap, deleteRoadmap, syncUserProfile } from './services/roadmapService';
import { supabase } from './services/supabaseClient';
import { AlertCircle, Star, X, Sparkles, ImageOff, Users } from 'lucide-react';
import heroImage from './assets/platform-screenshot.png';


const MAX_FREE_PROJECTS = 4;

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [projects, setProjects] = useState<Roadmap[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Auth & Settings State
  const [session, setSession] = useState<any>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Hero Image Error State
  const [heroImageError, setHeroImageError] = useState(false);
  
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [isPro, setIsPro] = useState<boolean>(false);

  // Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const hideNotification = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_pro, preferences')
        .eq('id', userId)
        .single();
      
      if (data) {
        setIsPro(data.is_pro || false);
        if (data.preferences?.darkMode) {
           document.documentElement.classList.add('dark');
        } else {
           document.documentElement.classList.remove('dark');
        }
      }
    } catch (e) {
      console.error("Error fetching user profile", e);
    }
  };

  // Initialize Session and Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        syncUserProfile(); // Ensure profile exists
        fetchUserProfile(session.user.id);
        loadProjects();
        // Redirect to profile on initial load if logged in
        if (appState === AppState.HOME) setAppState(AppState.PROFILE);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
         syncUserProfile(); // Ensure profile exists
         fetchUserProfile(session.user.id);
         loadProjects();
         
         // On login, go to Profile
         if (appState === AppState.AUTH || appState === AppState.HOME) {
             setAppState(AppState.PROFILE);
         }
      } else {
         setProjects([]); 
         setIsPro(false); 
         setAppState(AppState.HOME);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await fetchRoadmaps();
      setProjects(data);
    } catch (error: any) {
      console.error("Failed to fetch projects", error);
      setErrorMessage(error.message || "Failed to load projects.");
      setAppState(AppState.ERROR);
    }
  };

  const handleUpdateApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    if (key) setShowApiKeyModal(false);
  };

  const handleStartProject = () => {
    if (!session) {
      setAppState(AppState.AUTH);
      return;
    }

    if (!isPro && projects.length >= MAX_FREE_PROJECTS) {
      setShowLimitDialog(true);
      return;
    }

    setAppState(AppState.UPLOAD);
  };

  const handleUpgradeClick = () => {
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    if (session?.user?.id) {
       const { error } = await supabase
        .from('profiles')
        .upsert({ 
            id: session.user.id, 
            email: session.user.email,
            is_pro: true, 
            updated_at: new Date().toISOString() 
        }, { onConflict: 'id' });

       if (error) {
           console.error("Failed to update pro status", error);
           showNotification('Payment successful but failed to update status. Please refresh.', 'error');
       } else {
           setIsPro(true);
           setShowPaymentModal(false);
           setShowLimitDialog(false);
           showNotification('Welcome to Pro!', 'success');
       }
    }
  };

  const activeRoadmap = projects.find(p => p.id === activeProjectId) || null;

  const handleContentSubmit = async (input: GenerationInput) => {
    if (!session) {
      setAppState(AppState.AUTH);
      return;
    }

    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    setAppState(AppState.PROCESSING);
    setErrorMessage(null);

    try {
      const generatedRoadmap = await generateRoadmap(input, apiKey);
      
      const newProject: Roadmap = {
        ...generatedRoadmap,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        user_id: session.user.id
      };

      await createRoadmap(newProject);

      setProjects(prev => [newProject, ...prev]);
      setActiveProjectId(newProject.id!);
      setAppState(AppState.DASHBOARD);
      showNotification('Project created successfully', 'success');
    } catch (error) {
      console.error(error);
      setErrorMessage("We couldn't analyze that content. Please check your file size, API limits, or try different content.");
      setAppState(AppState.ERROR);
    }
  };

  const handleUpdateRoadmap = async (updatedRoadmap: Roadmap) => {
    setProjects(prev => prev.map(p => p.id === updatedRoadmap.id ? updatedRoadmap : p));
    try {
      await updateRoadmap(updatedRoadmap);
    } catch (e) {
      console.error("Failed to save update", e);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      const previousProjects = [...projects];
      const remainingProjects = previousProjects.filter(p => p.id !== id);
      setProjects(remainingProjects);
      
      if (appState === AppState.DASHBOARD) {
          setAppState(AppState.PROFILE);
          setActiveProjectId(null);
      }

      showNotification('Project deleted', 'success');

      try {
        await deleteRoadmap(id);
      } catch (e) {
        console.error("Failed to delete project", e);
        setProjects(previousProjects);
        showNotification("Could not delete project. Please check your connection.", 'error');
      }
    }
  };

  const handleRetry = () => {
    if (errorMessage && errorMessage.includes("Database")) {
         window.location.reload();
    } else {
        setAppState(AppState.UPLOAD);
        setErrorMessage(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderHome = () => (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-gray-900 selection:text-white flex flex-col lg:flex-row overflow-hidden">
      
      {/* LEFT SECTION: Content */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-8 lg:p-12 xl:p-16 relative z-10 bg-white">
        
        {/* Navbar */}
        <nav className="flex items-center justify-between w-full">
             <div className="flex items-center gap-12">
                 <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
                     <span className="font-bold text-xl tracking-tight">Cortexa</span>
                 </div>
                 <div className="hidden xl:flex items-center gap-6 text-sm font-medium text-gray-500">
                     <a href="#" className="hover:text-black transition-colors">Features</a>
                     <a href="#" className="hover:text-black transition-colors">Use Cases</a>
                     <a href="#" className="hover:text-black transition-colors">Pricing</a>
                 </div>
             </div>
             <div className="flex items-center gap-6">
                 <a href="#" className="hidden sm:block text-sm font-medium text-gray-500 hover:text-black transition-colors">Blog</a>
                 <button onClick={() => setAppState(AppState.AUTH)} className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Log in</button>
                 <button onClick={() => setAppState(AppState.AUTH)} className="px-4 py-2 border border-gray-200 text-gray-900 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">Sign up</button>
             </div>
        </nav>

        {/* Hero Content - Pushed to bottom left */}
        <div className="flex-1 flex flex-col justify-end max-w-xl pb-10 mt-20 lg:mt-0">
            {/* Badge */}
            <div className="mb-6 animate-fade-in">
               <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                  <div className="flex -space-x-2">
                     <div className="w-5 h-5 rounded-full border border-white bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600">A</div>
                     <div className="w-5 h-5 rounded-full border border-white bg-green-100 flex items-center justify-center text-[8px] font-bold text-green-600">J</div>
                     <div className="w-5 h-5 rounded-full border border-white bg-purple-100 flex items-center justify-center text-[8px] font-bold text-purple-600">M</div>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 ml-1">1000 of student and workers join us</span>
               </div>
            </div>

            {/* Headline - Smaller */}
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4 leading-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
               The All In One Platform<br />
               For Smarter Study Plans.
            </h1>

            {/* Subheadline */}
            <p className="text-base text-gray-500 mb-8 leading-relaxed animate-fade-in max-w-md" style={{ animationDelay: '0.2s' }}>
               Track progress, manage syllabi, and visualize performance — all without the noise.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
               <button 
                  onClick={() => setAppState(AppState.AUTH)}
                  className="w-full sm:w-auto px-6 py-3 border border-gray-200 text-gray-900 rounded-lg font-bold text-sm hover:bg-gray-50 transition-all shadow-sm"
               >
                  Start for Free
               </button>
            </div>
        </div>
      </div>

      {/* RIGHT SECTION: Colorful Background & Image */}
      <div className="hidden lg:block w-full lg:w-[55%] bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 relative overflow-hidden">
         {/* Decorative Blobs */}
         <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-200/40 rounded-full blur-3xl mix-blend-multiply filter opacity-70 animate-blob"></div>
         <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-3xl mix-blend-multiply filter opacity-70 animate-blob animation-delay-2000"></div>
         <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-3xl mix-blend-multiply filter opacity-70 animate-blob animation-delay-4000"></div>

         {/* Floating Image Container */}
         <div className="absolute inset-0 flex items-center justify-center p-12 pl-0">
             <div className="relative w-full h-full max-h-[800px] rounded-l-3xl overflow-hidden shadow-2xl border-[8px] border-r-0 border-white bg-white transform translate-x-12 hover:translate-x-10 transition-transform duration-700 ease-out">
                {/* Browser/App Header simulation inside the image container */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-2 z-10">
                   <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                   <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                   <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                </div>

                {/* The actual image */}
                <div className="absolute inset-0 top-8 bg-gray-50">
                    {!heroImageError ? (
                        <img 
                           src={heroImage}
                           alt="Dashboard Preview" 
                           className="w-full h-full object-cover object-left-top"
                           onError={() => setHeroImageError(true)}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full p-12 text-center bg-gray-50">
                             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <ImageOff className="w-8 h-8 text-gray-300" />
                             </div>
                             <h3 className="font-bold text-gray-400 mb-2">Image Placeholder</h3>
                             <p className="text-sm text-gray-400 max-w-sm">
                                Create <code>/assets/platform-screenshot.png</code> to see your dashboard here.
                             </p>
                        </div>
                    )}
                </div>
             </div>
         </div>
      </div>
    </div>
  );

  switch (appState) {
    case AppState.AUTH:
      return <Auth onSuccess={() => setAppState(AppState.PROFILE)} onCancel={() => setAppState(AppState.HOME)} />;
    
    case AppState.PROFILE:
      return session ? (
         <>
            <UserProfile 
               user={session.user}
               projects={projects}
               onStartProject={handleStartProject}
               onOpenProject={(id) => { setActiveProjectId(id); setAppState(AppState.DASHBOARD); }}
               onDeleteProject={handleDeleteProject}
               onLogout={handleLogout}
               apiKey={apiKey}
               onUpdateApiKey={handleUpdateApiKey}
               isPro={isPro}
               onUpgrade={handleUpgradeClick}
               maxFreeProjects={MAX_FREE_PROJECTS}
               onRefreshProjects={loadProjects}
            />
            {showApiKeyModal && (
                <ApiKeyModal 
                  onSave={handleUpdateApiKey}
                  onCancel={() => setShowApiKeyModal(false)}
                />
            )}
            {showPaymentModal && (
                <PaymentModal 
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => setShowPaymentModal(false)}
                />
            )}
            {showLimitDialog && (
              <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 dark:border-gray-800 p-6 text-center">
                    <h3 className="text-xl font-bold mb-2 dark:text-white">Upgrade Required</h3>
                    <p className="text-sm text-gray-500 mb-6">You need to upgrade to Pro to continue.</p>
                    <button onClick={handleUpgradeClick} className="w-full py-2 bg-indigo-600 text-white rounded-lg">Upgrade</button>
                    <button onClick={() => setShowLimitDialog(false)} className="mt-2 text-sm text-gray-500">Cancel</button>
                  </div>
              </div>
            )}
            <Toast 
               message={toast.message} 
               type={toast.type} 
               isVisible={toast.isVisible} 
               onClose={hideNotification} 
            />
         </>
      ) : renderHome();

    case AppState.UPLOAD:
      return (
        <div className="relative">
          {showApiKeyModal && (
            <ApiKeyModal 
              onSave={handleUpdateApiKey}
              onCancel={() => { setShowApiKeyModal(false); setAppState(AppState.PROFILE); }}
            />
          )}
          <div className="absolute top-4 left-4 z-10">
            <button 
              onClick={() => setAppState(AppState.PROFILE)}
              className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <FileUpload onContentSubmit={handleContentSubmit} isProcessing={false} />
        </div>
      );

    case AppState.PROCESSING:
      return <FileUpload onContentSubmit={() => {}} isProcessing={true} />;

    case AppState.DASHBOARD:
      if (activeRoadmap) {
        return (
          <>
            <Dashboard 
               roadmap={activeRoadmap} 
               allProjects={projects}
               onSwitchProject={(id) => { setActiveProjectId(id); setAppState(AppState.DASHBOARD); }}
               onUpdateRoadmap={handleUpdateRoadmap}
               onBack={() => setAppState(AppState.PROFILE)}
               onDeleteProject={() => activeProjectId && handleDeleteProject(activeProjectId)}
               onOpenSettings={() => setAppState(AppState.PROFILE)}
               apiKey={apiKey}
               onShowNotification={showNotification}
               currentUser={session?.user}
            />
            {showPaymentModal && (
                <PaymentModal 
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => setShowPaymentModal(false)}
                />
            )}
            <Toast 
               message={toast.message} 
               type={toast.type} 
               isVisible={toast.isVisible} 
               onClose={hideNotification} 
            />
          </>
        );
      }
      return renderHome();

    case AppState.ERROR:
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50 dark:bg-gray-950 animate-fade-in">
          <div className="w-16 h-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">{errorMessage || "An unknown error occurred."}</p>
          <div className="flex gap-4">
            <button 
              onClick={() => setAppState(AppState.PROFILE)}
              className="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-white dark:hover:bg-gray-800 transition-colors"
            >
              Go Back
            </button>
            <button 
              onClick={handleRetry}
              className="px-6 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:opacity-90 transition-opacity"
            >
              {errorMessage && errorMessage.includes("Database") ? "Refresh Page" : "Try Again"}
            </button>
          </div>
        </div>
      );

    case AppState.HOME:
    default:
      return renderHome();
  }
};

export default App;
