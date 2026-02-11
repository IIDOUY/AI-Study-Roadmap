import React from 'react';
import { Roadmap, Task } from '../types';
import { ArrowLeft, Calendar, CalendarDays, Clock, GripVertical } from 'lucide-react';
import { rescheduleRoadmap } from '../utils/scheduler';

interface PlanningProps {
  roadmap: Roadmap;
  onUpdateRoadmap: (roadmap: Roadmap) => void;
  onBack: () => void;
}

const Planning: React.FC<PlanningProps> = ({ roadmap, onUpdateRoadmap, onBack }) => {

  // Flatten tasks for linear timeline view
  const allTasks = roadmap.modules.flatMap(m => 
    m.tasks.map(t => ({ ...t, moduleTitle: m.title, moduleId: m.id }))
  );

  const handleDateChange = (task: Task, newDate: string) => {
    const updatedRoadmap = rescheduleRoadmap(roadmap, task, newDate);
    onUpdateRoadmap(updatedRoadmap);
  };

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA] dark:bg-gray-950 font-sans transition-colors duration-300">
      
      {/* Header */}
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
           <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500"
           >
             <ArrowLeft className="w-5 h-5" />
           </button>
           <div>
             <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                Planning & Timeline
             </h1>
             <p className="text-xs text-gray-500">{roadmap.title}</p>
           </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg">
           <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
           <span className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
             Total Duration: {roadmap.totalTimeEstimate}
           </span>
        </div>
      </header>

      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto p-6 relative">
        <div className="max-w-4xl mx-auto">
            
            {/* Timeline Vertical Line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800 transform -translate-x-1/2 hidden md:block" />

            <div className="space-y-6 relative">
                {allTasks.map((task, index) => {
                    const isLeft = index % 2 === 0;
                    
                    return (
                        <div key={task.id} className={`flex flex-col md:flex-row items-center gap-4 md:gap-0 ${isLeft ? '' : 'md:flex-row-reverse'}`}>
                            
                            {/* Date Marker (Mobile: Top, Desktop: Center) */}
                            <div className="md:absolute md:left-1/2 md:transform md:-translate-x-1/2 flex items-center justify-center z-10">
                                <div className="bg-white dark:bg-gray-900 border-2 border-indigo-500 rounded-full w-8 h-8 flex items-center justify-center shadow-sm">
                                    <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                                </div>
                            </div>

                            {/* Content Card */}
                            <div className={`w-full md:w-1/2 ${isLeft ? 'md:pr-12' : 'md:pl-12'}`}>
                                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                            {(task as any).moduleTitle}
                                        </span>
                                        <div className="p-1 rounded bg-gray-50 dark:bg-gray-700 text-gray-400 cursor-grab active:cursor-grabbing">
                                            <GripVertical className="w-3 h-3" />
                                        </div>
                                    </div>
                                    
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 line-clamp-1">
                                        {task.title}
                                    </h3>

                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 flex justify-center text-gray-400">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Start Date</label>
                                                <input 
                                                    type="date"
                                                    value={task.startDate || ''}
                                                    onChange={(e) => handleDateChange(task, e.target.value)}
                                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                             <div className="w-8 flex justify-center text-gray-400">
                                                <Clock className="w-4 h-4" />
                                             </div>
                                             <div className="flex-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                                <span>{task.estimatedMinutes} mins</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    task.priority === 'High' ? 'bg-red-50 text-red-600' :
                                                    task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                                                    'bg-blue-50 text-blue-600'
                                                }`}>
                                                    {task.priority}
                                                </span>
                                             </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Spacer for the other side in flexbox */}
                            <div className="w-full md:w-1/2 hidden md:block" />
                        </div>
                    );
                })}
            </div>

            {allTasks.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-gray-400">No tasks found to plan.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Planning;