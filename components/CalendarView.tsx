
import React, { useState, useMemo } from 'react';
import { Roadmap, Task } from '../types';
import { rescheduleRoadmap } from '../utils/scheduler';
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, PanelRightOpen, PanelRightClose } from 'lucide-react';

interface CalendarViewProps {
  roadmap: Roadmap;
  onUpdateRoadmap: (roadmap: Roadmap) => void;
}

interface TaskCardProps {
  task: Task;
  isCompact?: boolean;
  isDragged: boolean;
  onDragStart: (e: React.DragEvent, task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, isCompact = false, isDragged, onDragStart }) => (
  <div 
    draggable
    onDragStart={(e) => onDragStart(e, task)}
    className={`
      bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md 
      cursor-grab active:cursor-grabbing group transition-all rounded-lg relative overflow-hidden z-20
      ${isCompact ? 'p-2' : 'p-3'}
      ${isDragged ? 'opacity-40 border-dashed border-indigo-400 grayscale' : ''}
    `}
  >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
          task.priority === 'High' ? 'bg-red-500' : 
          task.priority === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
      }`} />
      
      <div className="pl-2">
          <div className="flex justify-between items-start mb-1">
              <span className={`text-[10px] font-bold text-gray-400 uppercase tracking-wider`}>
                  {task.estimatedMinutes}m
              </span>
              {task.isCompleted && <CheckCircle2 className="w-3 h-3 text-green-500" />}
          </div>
          <p className={`font-medium text-gray-900 dark:text-white leading-tight ${isCompact ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'} ${task.isCompleted ? 'line-through text-gray-400' : ''}`}>
              {task.title}
          </p>
          {!isCompact && (
              <div className="flex items-center gap-2 mt-2">
                  {task.resources && task.resources.length > 0 && (
                      <div className="flex -space-x-1">
                          <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-[8px] text-indigo-700 dark:text-indigo-300 border border-white dark:border-gray-800">
                              {task.resources.length}
                          </div>
                      </div>
                  )}
              </div>
          )}
      </div>
  </div>
);

const CalendarView: React.FC<CalendarViewProps> = ({ roadmap, onUpdateRoadmap }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Helper to get the start of the current week (Sunday)
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(currentDate);

  // Generate array of 7 days for the current view
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [startOfWeek]);

  // Flatten all tasks with their module ID for easy access
  const allTasks = useMemo(() => {
    return roadmap.modules.flatMap(m => m.tasks.map(t => ({ ...t, moduleId: m.id })));
  }, [roadmap]);

  const scheduledTasks = allTasks.filter(t => t.startDate);
  const unscheduledTasks = allTasks.filter(t => !t.startDate);

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return scheduledTasks.filter(t => t.startDate === dateStr);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string | null) => {
    e.preventDefault(); // Necessary for allowing drop
    e.dataTransfer.dropEffect = "move";
    
    // Only update state if it changes to avoid excessive re-renders
    if (dragOverDate !== dateStr) {
      setDragOverDate(dateStr);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Check if we are actually leaving the container (and not just entering a child)
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    
    if (!currentTarget.contains(relatedTarget)) {
       setDragOverDate(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetDateStr: string | null) => {
    e.preventDefault();
    setDragOverDate(null);
    
    // Try to get task from state, otherwise fallback to dataTransfer ID (robustness)
    let taskToMove = draggedTask;
    if (!taskToMove) {
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
            taskToMove = allTasks.find(t => t.id === taskId) || null;
        }
    }

    if (!taskToMove) return;

    // Prevent dropping on the same day if it's already scheduled there
    if (taskToMove.startDate === targetDateStr && targetDateStr !== null) {
        setDraggedTask(null);
        return;
    }

    let updatedRoadmap: Roadmap;

    if (targetDateStr) {
         updatedRoadmap = rescheduleRoadmap(roadmap, taskToMove, targetDateStr);
    } else {
        // Unschedule: Remove start/end dates
        const updatedModules = roadmap.modules.map(mod => ({
            ...mod,
            tasks: mod.tasks.map(t => 
                t.id === taskToMove!.id ? { ...t, startDate: undefined, endDate: undefined } : t
            )
        }));
        updatedRoadmap = { ...roadmap, modules: updatedModules };
    }

    onUpdateRoadmap(updatedRoadmap);
    setDraggedTask(null);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full w-full bg-[#FAFAFA] dark:bg-gray-950 font-sans overflow-hidden">
      
      {/* Main Calendar Area - Centered */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900 relative h-full order-1">
         
         {/* Calendar Header */}
         <div className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 z-20">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white hidden sm:block">Calendar</h1>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button onClick={prevWeek} className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-md shadow-sm transition-all text-gray-500 dark:text-gray-400">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={goToToday} className="px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all">
                        Today
                    </button>
                    <button onClick={nextWeek} className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-md shadow-sm transition-all text-gray-500 dark:text-gray-400">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 hidden sm:block">
                    {startOfWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                
                {/* Sidebar Toggle Button */}
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`p-2 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700 ${isSidebarOpen ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    title={isSidebarOpen ? "Hide To-do List" : "Show To-do List"}
                >
                    {isSidebarOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                </button>
            </div>
         </div>

         {/* Calendar Grid Container */}
         <div className="flex-1 overflow-hidden relative w-full h-full">
            <div className="absolute inset-0 overflow-auto"> 
               <div className="min-w-full lg:min-w-0 h-full flex flex-col">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 min-w-[700px] lg:min-w-0">
                     {weekDays.map((day, i) => {
                       const isToday = new Date().toDateString() === day.toDateString();
                       return (
                         <div key={i} className={`py-4 px-2 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0 flex flex-col items-center justify-center ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                            <div className={`text-xs font-bold uppercase mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            <div className={`text-lg font-bold flex items-center justify-center w-8 h-8 rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-900 dark:text-white'}`}>
                              {day.getDate()}
                            </div>
                         </div>
                       );
                     })}
                  </div>

                  {/* Days Columns */}
                  <div className="grid grid-cols-7 flex-1 min-h-0 bg-gray-50/30 dark:bg-gray-900/50 min-w-[700px] lg:min-w-0">
                      {weekDays.map((day, i) => {
                          const dateStr = day.toISOString().split('T')[0];
                          const tasks = getTasksForDate(day);
                          const isToday = new Date().toDateString() === day.toDateString();
                          const isDragOver = dragOverDate === dateStr;
                          
                          return (
                            <div 
                              key={i} 
                              className={`
                                border-r border-gray-100 dark:border-gray-800 last:border-r-0 p-2 space-y-2 min-h-[500px] transition-colors relative
                                ${isToday ? 'bg-white dark:bg-gray-900' : ''}
                                ${isDragOver ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-inset ring-2 ring-indigo-300 dark:ring-indigo-700' : ''}
                              `}
                              onDragOver={(e) => handleDragOver(e, dateStr)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, dateStr)}
                            >
                               {isDragOver && (
                                   <div className="absolute inset-2 rounded-lg pointer-events-none z-10 flex items-center justify-center">
                                       <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-300 font-bold text-sm bg-white/90 dark:bg-gray-900/90 px-3 py-1.5 rounded-full shadow-lg border border-indigo-100 dark:border-indigo-800 animate-bounce">
                                          <Plus className="w-4 h-4" /> Drop to schedule
                                       </div>
                                   </div>
                               )}
                               
                               {tasks.map(task => (
                                 <TaskCard 
                                    key={task.id} 
                                    task={task} 
                                    isDragged={draggedTask?.id === task.id}
                                    onDragStart={handleDragStart}
                                 />
                               ))}
                               
                               {/* Empty State visual aid (only on desktop or empty days to guide) */}
                               {tasks.length === 0 && !isDragOver && (
                                 <div className="h-full flex flex-col items-center pt-10 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity pointer-events-none">
                                    <div className="w-1 h-1 bg-gray-300 rounded-full mb-1" />
                                    <div className="w-1 h-1 bg-gray-300 rounded-full mb-1" />
                                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                 </div>
                               )}
                            </div>
                          );
                      })}
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Sidebar: Unscheduled Tasks - Right Side */}
      <div 
        className={`
            bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 flex flex-col shrink-0 lg:h-full lg:max-h-none transition-all duration-300 ease-in-out z-30 shadow-lg lg:shadow-none order-2
            ${isSidebarOpen ? 'w-full lg:w-80 translate-x-0' : 'w-0 translate-x-full border-l-0 overflow-hidden'}
        `}
      >
        <div className="w-full lg:w-80 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-md text-indigo-600 dark:text-indigo-400">
                    <PanelRightOpen className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                To-do List
                </h2>
            </div>
            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {unscheduledTasks.length}
            </span>
            </div>
            
            {/* Task List */}
            <div 
                className={`flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/30 dark:bg-black/20 transition-colors ${dragOverDate === null && draggedTask ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, null)}
            >
            {dragOverDate === null && draggedTask && (
                    <div className="border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg h-16 flex items-center justify-center text-xs text-indigo-500 font-medium mb-2 animate-pulse pointer-events-none">
                        Drop to unschedule
                    </div>
            )}
            {unscheduledTasks.map(task => (
                <TaskCard 
                    key={task.id} 
                    task={task} 
                    isDragged={draggedTask?.id === task.id}
                    onDragStart={handleDragStart}
                />
            ))}
            {unscheduledTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">All tasks scheduled</p>
                </div>
            )}
            </div>
        </div>
      </div>

    </div>
  );
};

export default CalendarView;
