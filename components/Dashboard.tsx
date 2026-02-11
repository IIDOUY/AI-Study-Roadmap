
import React, { useState, useMemo, useEffect } from 'react';
import { Roadmap, Task, SubTask, Resource, LastEditedBy } from '../types';
import { rescheduleRoadmap } from '../utils/scheduler';
import { inviteCollaborator, getCollaborators, removeCollaborator } from '../services/roadmapService';
import { supabase } from '../services/supabaseClient';
import CalendarView from './CalendarView';
import { 
  CheckCircle2, 
  Menu,
  X,
  Save,
  Clock,
  Layout,
  Settings as SettingsIcon,
  ArrowLeft,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Trash2,
  ListTodo,
  Plus,
  Edit2,
  Circle,
  CheckSquare,
  ChevronDown,
  Link as LinkIcon,
  ExternalLink,
  BookOpen,
  Globe,
  Calendar,
  CalendarDays,
  StickyNote,
  Share2,
  Users,
  UserPlus
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface DashboardProps {
  roadmap: Roadmap;
  allProjects: Roadmap[];
  onSwitchProject: (id: string) => void;
  onUpdateRoadmap: (roadmap: Roadmap) => void;
  onBack: () => void;
  onDeleteProject: () => void;
  onOpenSettings: () => void;
  apiKey: string;
  onShowNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  currentUser: any;
}

interface EditTaskState {
  moduleId: string;
  task: Task;
}

type ViewMode = 'list' | 'calendar';

export const Dashboard: React.FC<DashboardProps> = ({ 
  roadmap, 
  allProjects, 
  onSwitchProject, 
  onUpdateRoadmap, 
  onBack, 
  onDeleteProject, 
  onOpenSettings,
  apiKey,
  onShowNotification,
  currentUser
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingTask, setEditingTask] = useState<EditTaskState | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("");
  
  // Real-time & Collaboration
  const [collaborators, setCollaborators] = useState<{email: string, role: string, status: string}[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  
  // New Resource State
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  
  // Expanded Tasks State (for showing subtasks in list)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Note Visibility State
  const [visibleNotes, setVisibleNotes] = useState<Set<string>>(new Set());
  const [editingSubtaskNoteId, setEditingSubtaskNoteId] = useState<string | null>(null);

  // --- Real-time Subscription ---
  useEffect(() => {
    if (!roadmap.id) return;

    fetchCollaborators();

    const channel = supabase
      .channel(`roadmap-${roadmap.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'roadmaps', filter: `id=eq.${roadmap.id}` },
        (payload) => {
          if (payload.new) {
             const newRoadmap = payload.new as any;
             const mapped: Roadmap = {
                id: newRoadmap.id,
                title: newRoadmap.title,
                description: newRoadmap.description,
                totalTimeEstimate: newRoadmap.total_time_estimate,
                modules: newRoadmap.modules,
                createdAt: newRoadmap.created_at,
                user_id: newRoadmap.user_id
             };
             onUpdateRoadmap(mapped);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roadmap.id]);

  const fetchCollaborators = async () => {
      if (roadmap.id) {
          const cols = await getCollaborators(roadmap.id);
          setCollaborators(cols);
      }
  };

  const handleInvite = async () => {
      if (!inviteEmail || !roadmap.id) return;
      setIsInviting(true);
      try {
          await inviteCollaborator(roadmap.id, inviteEmail);
          onShowNotification(`Invited ${inviteEmail}`, 'success');
          setInviteEmail("");
          fetchCollaborators();
      } catch (e) {
          onShowNotification("Failed to invite user", 'error');
      } finally {
          setIsInviting(false);
      }
  };

  const handleRemoveCollaborator = async (email: string) => {
     if (!roadmap.id) return;
     try {
         await removeCollaborator(roadmap.id, email);
         fetchCollaborators();
         onShowNotification("Collaborator removed", 'success');
     } catch (e) {
         onShowNotification("Failed to remove", 'error');
     }
  };

  const getStamp = (): LastEditedBy => ({
      email: currentUser.email,
      at: new Date().toISOString()
  });

  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    let totalMins = 0;
    let completedMins = 0;

    const moduleData = roadmap.modules.map((mod, index) => {
      const modTotal = mod.tasks.length;
      const modCompleted = mod.tasks.filter(t => t.isCompleted).length;
      return {
        name: (index + 1).toString().padStart(2, '0'),
        fullTitle: mod.title,
        total: modTotal,
        completed: modCompleted,
        remaining: modTotal - modCompleted,
        isFullyComplete: modTotal > 0 && modTotal === modCompleted
      };
    });

    roadmap.modules.forEach(mod => {
      mod.tasks.forEach(task => {
        total++;
        totalMins += task.estimatedMinutes;
        if (task.isCompleted) {
          completed++;
          completedMins += task.estimatedMinutes;
        }
      });
    });

    return { 
      total, 
      completed, 
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      totalMins,
      completedMins,
      moduleData
    };
  }, [roadmap]);

  const getPriorityColors = (p: string) => {
    switch(p) {
      case 'High': return 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50';
      case 'Medium': return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50';
      case 'Low': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50';
      default: return 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'link';
    }
  };

  const updateTask = (moduleId: string, taskId: string, updates: Partial<Task>) => {
    const updatedModules = roadmap.modules.map(mod => {
      if (mod.id !== moduleId) return mod;
      const updatedTasks = mod.tasks.map(task => {
        if (task.id !== taskId) return task;
        
        const now = new Date().toISOString();
        let additionalUpdates: Partial<Task> = {};
        
        if (updates.isCompleted === true) {
             additionalUpdates = { completedAt: now };
        } else if (updates.isCompleted === false) {
             additionalUpdates = { completedAt: undefined };
        }

        return { ...task, ...updates, ...additionalUpdates, lastEditedBy: getStamp() };
      });
      return { ...mod, tasks: updatedTasks };
    });

    const newRoadmap = { ...roadmap, modules: updatedModules };
    onUpdateRoadmap(newRoadmap);

    if (updates.isCompleted === true) {
      onShowNotification('Task marked as complete', 'success');
    }
  };
  
  const handleToggleSubTaskInList = (moduleId: string, taskId: string, subTaskId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const module = roadmap.modules.find(m => m.id === moduleId);
      if (!module) return;
      
      const task = module.tasks.find(t => t.id === taskId);
      if (!task) return;
      
      const updatedSubTasks = task.subTasks?.map(st => 
        st.id === subTaskId ? { ...st, isCompleted: !st.isCompleted, lastEditedBy: getStamp() } : st
      );
      
      updateTask(moduleId, taskId, { subTasks: updatedSubTasks });
  };

  const handleDeleteTask = (moduleId: string, taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      const updatedModules = roadmap.modules.map(mod => {
        if (mod.id !== moduleId) return mod;
        return { ...mod, tasks: mod.tasks.filter(t => t.id !== taskId) };
      });
      onUpdateRoadmap({ ...roadmap, modules: updatedModules });
      setEditingTask(null);
      onShowNotification('Task deleted', 'success');
    }
  };

  const handleSaveEdit = () => {
    if (!editingTask) return;

    const reshuffledRoadmap = rescheduleRoadmap(roadmap, editingTask.task, editingTask.task.startDate || '');
    
    const finalModules = reshuffledRoadmap.modules.map(mod => {
      if (mod.id !== editingTask.moduleId) return mod;
      return {
          ...mod,
          tasks: mod.tasks.map(t => {
              if (t.id === editingTask.task.id) {
                  const completionUpdate = editingTask.task.isCompleted && !t.isCompleted ? { completedAt: new Date().toISOString() } : {};
                  return { 
                      ...t, 
                      ...editingTask.task, 
                      ...completionUpdate,
                      startDate: t.startDate, 
                      endDate: t.endDate, 
                      lastEditedBy: getStamp() 
                  }; 
              }
              return t;
          })
      };
    });

    const finalRoadmap = { ...reshuffledRoadmap, modules: finalModules };
    
    if (finalRoadmap.totalTimeEstimate !== roadmap.totalTimeEstimate) {
        onShowNotification(`Schedule updated. New duration: ${finalRoadmap.totalTimeEstimate}`, 'success');
    } else {
        onShowNotification('Changes saved', 'success');
    }

    onUpdateRoadmap(finalRoadmap);
    setEditingTask(null);
  };

  const handleAddSubTask = () => {
    if (editingTask && newSubTaskTitle.trim()) {
      const newSubTask: SubTask = {
        id: crypto.randomUUID(),
        title: newSubTaskTitle,
        isCompleted: false,
        lastEditedBy: getStamp()
      };
      
      const updatedTask = {
        ...editingTask.task,
        subTasks: [...(editingTask.task.subTasks || []), newSubTask]
      };
      
      setEditingTask({ ...editingTask, task: updatedTask });
      setNewSubTaskTitle("");
    }
  };

  const handleUpdateSubTask = (subTaskId: string, updates: Partial<SubTask>) => {
    if (editingTask) {
      const updatedSubTasks = editingTask.task.subTasks?.map(st => 
        st.id === subTaskId ? { ...st, ...updates, lastEditedBy: getStamp() } : st
      );
      setEditingTask({ ...editingTask, task: { ...editingTask.task, subTasks: updatedSubTasks } });
    }
  };

  const handleDeleteSubTask = (subTaskId: string) => {
    if (editingTask) {
      const updatedSubTasks = editingTask.task.subTasks?.filter(st => st.id !== subTaskId);
      setEditingTask({ ...editingTask, task: { ...editingTask.task, subTasks: updatedSubTasks } });
    }
  };

  const handleAddResource = () => {
    if (editingTask && newResourceTitle.trim() && newResourceUrl.trim()) {
       const newResource: Resource = {
         id: crypto.randomUUID(),
         title: newResourceTitle,
         url: newResourceUrl.startsWith('http') ? newResourceUrl : `https://${newResourceUrl}`
       };
       
       const updatedTask = {
         ...editingTask.task,
         resources: [...(editingTask.task.resources || []), newResource]
       };

       setEditingTask({ ...editingTask, task: updatedTask });
       setNewResourceTitle("");
       setNewResourceUrl("");
    }
  };

  const handleDeleteResource = (resourceId: string) => {
    if (editingTask) {
      const updatedResources = editingTask.task.resources?.filter(r => r.id !== resourceId);
      setEditingTask({ ...editingTask, task: { ...editingTask.task, resources: updatedResources } });
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedTasks(new Set());
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };
  
  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
        newExpanded.delete(taskId);
    } else {
        newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const toggleNoteVisibility = (id: string) => {
    const newVisible = new Set(visibleNotes);
    if (newVisible.has(id)) newVisible.delete(id);
    else newVisible.add(id);
    setVisibleNotes(newVisible);
  };

  const handleBatchComplete = (isCompleted: boolean) => {
    const now = new Date().toISOString();
    const updatedModules = roadmap.modules.map(mod => ({
      ...mod,
      tasks: mod.tasks.map(t => 
        selectedTasks.has(t.id) ? { 
            ...t, 
            isCompleted,
            completedAt: isCompleted ? now : undefined,
            lastEditedBy: getStamp() 
        } : t
      )
    }));
    
    onUpdateRoadmap({ ...roadmap, modules: updatedModules });
    onShowNotification(`${selectedTasks.size} tasks ${isCompleted ? 'completed' : 'updated'}`, 'success');
    setSelectionMode(false);
    setSelectedTasks(new Set());
  };

  const handleBatchDelete = () => {
      if (selectedTasks.size === 0) return;
      if (!window.confirm(`Are you sure you want to delete ${selectedTasks.size} tasks?`)) return;

      const updatedModules = roadmap.modules.map(mod => ({
        ...mod,
        tasks: mod.tasks.filter(t => !selectedTasks.has(t.id))
      }));

      onUpdateRoadmap({ ...roadmap, modules: updatedModules });
      onShowNotification(`${selectedTasks.size} tasks deleted`, 'success');
      setSelectionMode(false);
      setSelectedTasks(new Set());
  };

  const scrollToModule = (id: string) => {
    const el = document.getElementById(`module-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-100 dark:border-gray-700 shadow-xl rounded-lg text-xs">
          <p className="font-bold text-gray-900 dark:text-white mb-1">Module {label}</p>
          <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-[150px] truncate">{data.fullTitle}</p>
          <div className="flex items-center gap-2 mb-1">
             <div className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100"></div>
             <span className="text-gray-600 dark:text-gray-300">Completed: {data.completed}</span>
          </div>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-600"></div>
             <span className="text-gray-600 dark:text-gray-300">Total: {data.total}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen bg-[#FAFAFA] dark:bg-gray-950 overflow-hidden font-sans transition-colors duration-300">
      
      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col justify-between
      `}>
        <div className="flex flex-col h-full">
          {/* Logo / Header */}
          <div className="h-16 flex items-center px-6 cursor-pointer" onClick={onBack}>
             <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
               <ArrowLeft className="w-4 h-4" />
               <span>All Projects</span>
             </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
             {/* Current Roadmap Section */}
             <div>
                <div className="px-2 mb-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Essentials</div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`w-full text-left px-2 py-2 text-sm rounded-lg flex items-center gap-3 transition-colors ${viewMode === 'list' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    <ListTodo className="w-4 h-4" />
                    <span className="font-medium">Tasks</span>
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`w-full text-left px-2 py-2 text-sm rounded-lg flex items-center gap-3 transition-colors ${viewMode === 'calendar' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Planning</span>
                  </button>
                </div>
             </div>

             {/* Module Navigation (Only in List View) */}
             {viewMode === 'list' && (
                 <div>
                    <div className="px-2 mb-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Modules</div>
                    <div className="space-y-0.5">
                      {roadmap.modules.map((mod, i) => (
                        <button
                          key={mod.id}
                          onClick={() => scrollToModule(mod.id)}
                          className="w-full text-left px-2 py-2 text-sm text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-3 group"
                        >
                          <span className={`w-6 h-6 flex items-center justify-center text-[10px] rounded bg-gray-100 dark:bg-gray-800 font-mono transition-colors group-hover:bg-gray-200 dark:group-hover:bg-gray-700 text-gray-600 dark:text-gray-400`}>
                            {(i + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="truncate font-medium">{mod.title}</span>
                        </button>
                      ))}
                    </div>
                 </div>
             )}

             {/* Switch Project Section */}
             <div>
                <div className="px-2 mb-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Switch Project</div>
                <div className="space-y-0.5">
                  {allProjects.map(proj => (
                    <button
                        key={proj.id}
                        onClick={() => onSwitchProject(proj.id!)}
                        className={`w-full text-left px-2 py-2 text-sm font-medium rounded-lg flex items-center gap-2 truncate transition-colors
                          ${proj.id === roadmap.id ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}
                        `}
                    >
                        <Layout className="w-4 h-4 shrink-0" />
                        <span className="truncate">{proj.title}</span>
                    </button>
                  ))}
                </div>
             </div>
          </div>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-50 dark:border-gray-800">
             <button 
                onClick={onDeleteProject}
                className="flex items-center gap-2 w-full px-2 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
             >
                <Trash2 className="w-4 h-4" />
                <span>Delete Project</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      {viewMode === 'calendar' ? (
        <CalendarView roadmap={roadmap} onUpdateRoadmap={onUpdateRoadmap} />
      ) : (
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white dark:bg-gray-900">
        
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md"
             >
               <Menu className="w-5 h-5" />
             </button>
             <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <span onClick={onBack} className="hover:text-gray-900 dark:hover:text-white cursor-pointer">Projects</span>
                <ChevronRight className="w-4 h-4 mx-1" />
                <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-md">{roadmap.title}</span>
             </nav>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300">
                <Clock className="w-3.5 h-3.5" />
                <span>Total: {roadmap.totalTimeEstimate}</span>
             </div>

             <button 
                onClick={() => setShowShareModal(true)}
                className="px-3 py-1.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-2 text-xs font-medium"
             >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
             </button>
             
             {/* Selection Mode Toggle */}
             <button 
                onClick={toggleSelectionMode}
                className={`
                  px-3 py-1.5 rounded-md border transition-colors flex items-center gap-2 text-xs font-medium
                  ${selectionMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
                `}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{selectionMode ? 'Done' : 'Select'}</span>
             </button>

             <button 
                onClick={onOpenSettings}
                className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-white transition-colors"
             >
               <SettingsIcon className="w-5 h-5" />
             </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 scroll-smooth pb-24">
          <div className="max-w-6xl mx-auto space-y-12">
             
             {/* Project Header */}
             <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{roadmap.title}</h1>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed max-w-3xl">{roadmap.description}</p>
             </div>

             {/* Statistics Cards */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Progress Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between h-48">
                   <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      <PieChartIcon className="w-4 h-4" />
                      Progress
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                         {/* Responsive SVG Circular Progress */}
                         <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" stroke="currentColor" className="text-gray-100 dark:text-gray-700" strokeWidth="8" fill="transparent" />
                            <circle cx="50" cy="50" r="40" stroke="currentColor" className="text-gray-900 dark:text-white" strokeWidth="8" fill="transparent" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - stats.percent / 100)}`} strokeLinecap="round" />
                         </svg>
                         <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white">{stats.percent}%</span>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.completed}/{stats.total}</div>
                         <div className="text-sm text-gray-400 mt-1">Tasks Completed</div>
                      </div>
                   </div>
                </div>

                {/* 2. Time Invested Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between h-48">
                   <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      <Clock className="w-4 h-4" />
                      Time Invested
                   </div>
                   <div>
                      <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{formatDuration(stats.completedMins)}</div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-3 overflow-hidden">
                         <div className="h-full bg-gray-900 dark:bg-white rounded-full" style={{ width: `${(stats.completedMins / Math.max(stats.totalMins, 1)) * 100}%` }} />
                      </div>
                      <p className="text-sm text-gray-400">{formatDuration(stats.totalMins - stats.completedMins)} remaining</p>
                   </div>
                </div>

                {/* 3. Module Progress Bar Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-48">
                   <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      <BarChartIcon className="w-4 h-4" />
                      Module Progress
                   </div>
                   <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={stats.moduleData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-gray-700" />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={0} stroke="#9CA3AF" dy={5} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#9CA3AF" />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                            <Bar dataKey="completed" stackId="a" fill="currentColor" className="text-gray-900 dark:text-white" radius={[0, 0, 4, 4]} barSize={12} />
                            <Bar dataKey="remaining" stackId="a" fill="currentColor" className="text-gray-100 dark:text-gray-600" radius={[4, 4, 0, 0]} barSize={12} />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>

             {/* Modules List */}
             {roadmap.modules.map((module, index) => (
                <section key={module.id} id={`module-${module.id}`} className="scroll-mt-24">
                   <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-lg font-bold text-gray-300 dark:text-gray-600 font-mono">{(index + 1).toString().padStart(2, '0')}</span>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">{module.title}</h2>
                   </div>
                   
                   <div className="space-y-3">
                      {module.tasks.map((task) => (
                         <div 
                           key={task.id}
                           className={`
                             rounded-xl border transition-all bg-white dark:bg-gray-800
                             ${selectionMode && selectedTasks.has(task.id) 
                               ? 'border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/10 dark:bg-indigo-900/10' 
                               : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm'}
                           `}
                         >
                            <div 
                                className="group flex items-center gap-4 p-4 cursor-pointer"
                                onClick={() => {
                                    if (selectionMode) {
                                      toggleTaskSelection(task.id);
                                    } else {
                                      setEditingTask({ moduleId: module.id, task: { ...task } });
                                    }
                                  }}
                            >
                                {/* Checkbox Area */}
                                <div className="flex-shrink-0" onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectionMode) {
                                      toggleTaskSelection(task.id);
                                    } else {
                                      updateTask(module.id, task.id, { isCompleted: !task.isCompleted });
                                    }
                                }}>
                                    {selectionMode ? (
                                        selectedTasks.has(task.id) ? (
                                            <div className="w-5 h-5 bg-indigo-600 rounded border border-indigo-600 flex items-center justify-center">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 rounded border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700" />
                                        )
                                    ) : (
                                        <div className={`w-5 h-5 rounded border transition-colors flex items-center justify-center
                                            ${task.isCompleted ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 hover:border-gray-400'}
                                        `}>
                                            {task.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Title Area */}
                                <div className="flex-1 min-w-0">
                                   <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                     <p className={`text-sm font-medium transition-colors ${task.isCompleted ? 'text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600' : 'text-gray-900 dark:text-white'}`}>
                                       {task.title}
                                     </p>
                                     {task.startDate && (
                                       <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-700 w-fit">
                                          <CalendarDays className="w-3 h-3" />
                                          {task.startDate}
                                       </span>
                                     )}
                                   </div>
                                </div>

                                {/* Metadata Area (Visible unless selection mode) */}
                                {!selectionMode && (
                                   <div className="flex items-center gap-4">
                                     
                                     {/* Edited By Indicator */}
                                     {task.lastEditedBy && task.lastEditedBy.email !== currentUser.email && (
                                         <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-300" title={`Last edited by ${task.lastEditedBy.email} on ${new Date(task.lastEditedBy.at).toLocaleDateString()}`}>
                                             <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[8px] font-bold">
                                                 {getInitials(task.lastEditedBy.email)}
                                             </div>
                                             <span className="truncate max-w-[60px]">Edited</span>
                                         </div>
                                     )}

                                     {/* Note Toggle */}
                                     {task.notes && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleNoteVisibility(task.id); }}
                                            className={`p-1 rounded transition-colors ${visibleNotes.has(task.id) ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                            title="View Notes"
                                        >
                                            <StickyNote className="w-4 h-4" />
                                        </button>
                                     )}

                                     {/* Priority Badge */}
                                     <span className={`text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider ${getPriorityColors(task.priority)}`}>
                                        {task.priority}
                                     </span>
                                     
                                     {/* Time */}
                                     <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{task.estimatedMinutes}m</span>
                                     </div>

                                     {/* Link Indicator (if resources exist) */}
                                     {task.resources && task.resources.length > 0 && (
                                       <div className="flex items-center gap-1 text-xs text-indigo-500 font-medium">
                                         <LinkIcon className="w-3.5 h-3.5" />
                                         <span className="hidden sm:inline">{task.resources.length}</span>
                                       </div>
                                     )}
                                     
                                     {/* Subtask/Expansion Toggle Chevron */}
                                     {((task.subTasks && task.subTasks.length > 0) || (task.resources && task.resources.length > 0)) && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); toggleTaskExpansion(task.id); }}
                                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                        >
                                           <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expandedTasks.has(task.id) ? 'rotate-180' : ''}`} />
                                        </button>
                                     )}

                                     {/* Edit Button */}
                                     <button
                                        className={`p-1.5 rounded text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTask({ moduleId: module.id, task: { ...task } });
                                        }}
                                     >
                                        <Edit2 className="w-4 h-4" />
                                     </button>
                                   </div>
                                )}
                            </div>
                            
                            {/* Inline Note (Task) */}
                            {visibleNotes.has(task.id) && task.notes && !selectionMode && (
                                <div className="px-14 pb-4 text-sm text-gray-600 dark:text-gray-300 animate-fade-in">
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg">
                                        {task.notes}
                                    </div>
                                </div>
                            )}
                            
                            {/* Expanded Content (Subtasks + Resources) */}
                            {expandedTasks.has(task.id) && !selectionMode && (
                                <div className="px-4 pb-4 pl-14 space-y-4 border-t border-gray-50 dark:border-gray-700 pt-3 animate-fade-in">
                                     {/* Subtasks */}
                                     {task.subTasks && task.subTasks.length > 0 && (
                                       <div className="space-y-2">
                                         {task.subTasks.map(st => (
                                            <div key={st.id} className="flex flex-col gap-2 group/sub">
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                    onClick={(e) => handleToggleSubTaskInList(module.id, task.id, st.id, e)}
                                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${st.isCompleted ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}`}
                                                    >
                                                    {st.isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    </button>
                                                    <span className={`text-sm ${st.isCompleted ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300'}`}>
                                                        {st.title}
                                                    </span>
                                                    
                                                    {st.notes && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleNoteVisibility(st.id); }}
                                                            className={`ml-auto p-1 rounded transition-colors ${visibleNotes.has(st.id) ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-gray-300 hover:text-gray-500'}`}
                                                            title="View Note"
                                                        >
                                                            <StickyNote className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {/* Inline Note (Subtask) */}
                                                {visibleNotes.has(st.id) && st.notes && (
                                                    <div className="ml-7 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded text-xs text-gray-600 dark:text-gray-300 animate-fade-in">
                                                        {st.notes}
                                                    </div>
                                                )}
                                            </div>
                                         ))}
                                       </div>
                                     )}

                                     {/* Resources */}
                                     {task.resources && task.resources.length > 0 && (
                                       <div>
                                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                              <BookOpen className="w-3 h-3" />
                                              Resources & Material
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {task.resources.map(res => (
                                              <a 
                                                key={res.id} 
                                                href={res.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-gray-600 transition-all group/link"
                                              >
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                                    <Globe className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-400 transition-colors">{res.title}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{getHostname(res.url)}</div>
                                                </div>
                                                <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover/link:text-indigo-500 transition-colors" />
                                              </a>
                                            ))}
                                          </div>
                                       </div>
                                     )}
                                </div>
                            )}
                         </div>
                      ))}
                   </div>
                </section>
             ))}
          </div>
        </div>
      </main>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setEditingTask(null)}
        >
           <div 
             className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-gray-100 dark:border-gray-800 overflow-hidden"
             onClick={e => e.stopPropagation()}
           >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 z-10">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        Edit Task
                    </h3>
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={() => handleDeleteTask(editingTask.moduleId, editingTask.task.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete Task"
                         >
                            <Trash2 className="w-5 h-5" />
                         </button>
                         <button onClick={() => setEditingTask(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                         </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* Title Input */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Task Title</label>
                        <input
                            type="text"
                            value={editingTask.task.title}
                            onChange={(e) => setEditingTask({
                                ...editingTask,
                                task: { ...editingTask.task, title: e.target.value }
                            })}
                            className="w-full text-lg font-bold bg-transparent border-b border-gray-200 dark:border-gray-700 pb-2 outline-none focus:border-indigo-500 text-gray-900 dark:text-white transition-colors placeholder-gray-300"
                            placeholder="Task Name"
                        />
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" /> Est. Minutes
                            </label>
                            <input
                                type="number"
                                value={editingTask.task.estimatedMinutes}
                                onChange={(e) => setEditingTask({
                                    ...editingTask,
                                    task: { ...editingTask.task, estimatedMinutes: parseInt(e.target.value) || 0 }
                                })}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                <CheckSquare className="w-3.5 h-3.5" /> Priority
                            </label>
                            <select
                                value={editingTask.task.priority}
                                onChange={(e) => setEditingTask({
                                    ...editingTask,
                                    task: { ...editingTask.task, priority: e.target.value as any }
                                })}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            >
                                <option value="High">High Priority</option>
                                <option value="Medium">Medium Priority</option>
                                <option value="Low">Low Priority</option>
                            </select>
                         </div>
                         
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                <CalendarDays className="w-3.5 h-3.5" /> Start Date
                            </label>
                            <input
                                type="date"
                                value={editingTask.task.startDate || ''}
                                onChange={(e) => setEditingTask({
                                    ...editingTask,
                                    task: { ...editingTask.task, startDate: e.target.value }
                                })}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> End Date (Optional)
                            </label>
                            <input
                                type="date"
                                value={editingTask.task.endDate || ''}
                                onChange={(e) => setEditingTask({
                                    ...editingTask,
                                    task: { ...editingTask.task, endDate: e.target.value }
                                })}
                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            />
                         </div>
                    </div>
                    
                    {/* Notes Section */}
                    <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                            <StickyNote className="w-3.5 h-3.5" /> Notes
                         </label>
                         <textarea
                            value={editingTask.task.notes || ''}
                            onChange={(e) => setEditingTask({
                                ...editingTask,
                                task: { ...editingTask.task, notes: e.target.value }
                            })}
                            className="w-full bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 min-h-[100px] focus:ring-2 focus:ring-yellow-400 outline-none resize-none"
                            placeholder="Add personal notes, reflections, or reminders here..."
                         />
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    {/* Subtasks Management */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                             <label className="block text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <ListTodo className="w-3.5 h-3.5" /> Subtasks
                             </label>
                             <span className="text-xs text-gray-400">{editingTask.task.subTasks?.length || 0} items</span>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                            {editingTask.task.subTasks?.map(st => (
                                <div key={st.id} className="group flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleUpdateSubTask(st.id, { isCompleted: !st.isCompleted })}
                                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${st.isCompleted ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}`}
                                        >
                                            {st.isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                                        </button>
                                        <input 
                                            type="text"
                                            value={st.title}
                                            onChange={(e) => handleUpdateSubTask(st.id, { title: e.target.value })}
                                            className={`flex-1 bg-transparent border-none text-sm outline-none ${st.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}
                                        />
                                        
                                        <button
                                            onClick={() => setEditingSubtaskNoteId(editingSubtaskNoteId === st.id ? null : st.id)}
                                            className={`p-1.5 rounded transition-colors ${st.notes || editingSubtaskNoteId === st.id ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-400 hover:text-gray-600'}`}
                                            title="Add Note"
                                        >
                                            <StickyNote className="w-3.5 h-3.5" />
                                        </button>

                                        <button 
                                            onClick={() => handleDeleteSubTask(st.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    
                                    {/* Subtask Note Input */}
                                    {(editingSubtaskNoteId === st.id || st.notes) && (
                                        <div className="ml-7">
                                            <textarea
                                                value={st.notes || ''}
                                                onChange={(e) => handleUpdateSubTask(st.id, { notes: e.target.value })}
                                                placeholder="Add a note for this subtask..."
                                                className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 focus:border-indigo-500 outline-none text-gray-600 dark:text-gray-400 resize-none"
                                                rows={2}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={newSubTaskTitle}
                                onChange={(e) => setNewSubTaskTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddSubTask()}
                                placeholder="Add new subtask..."
                                className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                            />
                            <button 
                                onClick={handleAddSubTask}
                                disabled={!newSubTaskTitle.trim()}
                                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    {/* Resources Management */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                             <label className="block text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <LinkIcon className="w-3.5 h-3.5" /> Resources
                             </label>
                             <span className="text-xs text-gray-400">{editingTask.task.resources?.length || 0} links</span>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                            {editingTask.task.resources?.map(res => (
                                <div key={res.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 group">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                        <Globe className="w-3 h-3" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{res.title}</p>
                                        <a href={res.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline truncate block">{res.url}</a>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteResource(res.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <input 
                                type="text"
                                value={newResourceTitle}
                                onChange={(e) => setNewResourceTitle(e.target.value)}
                                placeholder="Link Title (e.g. Video)"
                                className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                            />
                            <input 
                                type="text"
                                value={newResourceUrl}
                                onChange={(e) => setNewResourceUrl(e.target.value)}
                                placeholder="URL (https://...)"
                                className="flex-[2] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                            />
                            <button 
                                onClick={handleAddResource}
                                disabled={!newResourceTitle.trim() || !newResourceUrl.trim()}
                                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3 shrink-0">
                    <button 
                        onClick={() => setEditingTask(null)}
                        className="px-6 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveEdit}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all transform active:scale-[0.98] flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>
           </div>
        </div>
      )}

      {/* Bulk Actions Bottom Sheet - Professional & Compact */}
      {selectionMode && selectedTasks.size > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[60]">
            <div className="bg-gray-900/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-gray-900 rounded-full shadow-2xl py-2 px-5 flex items-center gap-5 border border-gray-800/50 dark:border-gray-200/50 ring-1 ring-black/5 transition-all hover:scale-[1.02]">
                
                {/* Selection Count */}
                <div className="flex items-center gap-2 pr-2 border-r border-gray-700 dark:border-gray-200/50">
                    <span className="font-bold text-sm tabular-nums">{selectedTasks.size}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium hidden sm:inline">Selected</span>
                </div>

                {/* Actions Group */}
                <div className="flex items-center gap-2">
                    {/* Mark Complete */}
                    <button
                        onClick={() => handleBatchComplete(true)}
                        className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 dark:hover:bg-black/5 transition-all active:scale-95"
                        title="Mark as Done"
                    >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                        <span className="text-xs font-semibold tracking-wide">Done</span>
                    </button>

                    {/* Mark Incomplete */}
                    <button
                        onClick={() => handleBatchComplete(false)}
                        className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 dark:hover:bg-black/5 transition-all active:scale-95"
                        title="Mark as Undone"
                    >
                        <Circle className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-white dark:group-hover:text-black transition-colors" />
                        <span className="text-xs font-semibold text-gray-300 dark:text-gray-600 group-hover:text-white dark:group-hover:text-black transition-colors">Undone</span>
                    </button>

                    {/* Delete */}
                    <button
                        onClick={handleBatchDelete}
                        className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-red-500/20 dark:hover:bg-red-50 transition-all active:scale-95 ml-1"
                        title="Delete Selected"
                    >
                        <Trash2 className="w-4 h-4 text-red-400 dark:text-red-500" />
                        <span className="text-xs font-semibold text-red-400 dark:text-red-600">Delete</span>
                    </button>
                    
                    {/* Close Selection Mode */}
                    <button 
                        onClick={() => {
                            setSelectionMode(false);
                            setSelectedTasks(new Set());
                        }}
                        className="ml-2 p-1.5 rounded-full bg-gray-800 dark:bg-gray-100 text-gray-400 hover:text-white dark:hover:text-black transition-colors"
                        title="Cancel Selection"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        Share Project
                    </h3>
                    <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Invite Section */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Invite by Email</label>
                        <div className="flex gap-2">
                            <input 
                                type="email" 
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="colleague@example.com"
                                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                            />
                            <button 
                                onClick={handleInvite}
                                disabled={isInviting || !inviteEmail.trim()}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {isInviting ? <Clock className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                Invite
                            </button>
                        </div>
                    </div>

                    {/* Collaborators List */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Current Access</h4>
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                                        {getInitials(roadmap.owner_email || currentUser.email || 'OW')}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{roadmap.user_id === currentUser.id ? currentUser.email : (roadmap.owner_email || 'Project Owner')}</p>
                                        <p className="text-[10px] text-gray-500">Owner</p>
                                    </div>
                                </div>
                            </div>

                            {collaborators.map((col) => (
                                <div key={col.email} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-xs">
                                            {getInitials(col.email)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{col.email}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-500 capitalize">{col.role}</span>
                                                {col.status === 'pending' && (
                                                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">Pending</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveCollaborator(col.email)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Remove Access"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            {collaborators.length === 0 && (
                                <p className="text-center text-xs text-gray-400 py-2">No other collaborators yet.</p>
                            )}
                        </div>
                    </div>
                </div>
           </div>
        </div>
      )}

    </div>
  );
};
