import { Roadmap, Task, Module } from '../types';

/**
 * Adds milliseconds to a date string and returns YYYY-MM-DD
 */
export const addTime = (dateStr: string, diffMs: number): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const newDate = new Date(date.getTime() + diffMs);
  return newDate.toISOString().split('T')[0];
};

/**
 * Recalculates the total duration string based on the earliest start and latest end date
 */
export const recalculateTotalTime = (modules: Module[]): string => {
  let minDate = new Date(8640000000000000); // Max date
  let maxDate = new Date(-8640000000000000); // Min date
  let hasDates = false;

  modules.forEach(mod => {
    mod.tasks.forEach(task => {
      if (task.startDate) {
        const start = new Date(task.startDate);
        if (start < minDate) minDate = start;
        hasDates = true;
      }
      if (task.endDate) {
        const end = new Date(task.endDate);
        if (end > maxDate) maxDate = end;
      } else if (task.startDate) {
        // Fallback if no end date, assume 1 day
        const start = new Date(task.startDate);
        if (start > maxDate) maxDate = start;
      }
    });
  });

  if (!hasDates) return "Not scheduled";

  const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include start day

  if (diffDays > 30) {
    const weeks = Math.round(diffDays / 7);
    return `${weeks} weeks`;
  }
  return `${diffDays} days`;
};

/**
 * Handles the logic of shifting future tasks when a task is moved
 */
export const rescheduleRoadmap = (roadmap: Roadmap, movedTask: Task, newStartDate: string): Roadmap => {
    const originalModule = roadmap.modules.find(m => m.tasks.some(t => t.id === movedTask.id));
    const originalTask = originalModule?.tasks.find(t => t.id === movedTask.id);

    // If no date change or task not found, just return updated roadmap with single task change
    if (!originalTask?.startDate || !newStartDate || originalTask.startDate === newStartDate) {
         // Just update the single task
         const updatedModules = roadmap.modules.map(mod => ({
            ...mod,
            tasks: mod.tasks.map(t => t.id === movedTask.id ? { ...t, startDate: newStartDate } : t)
         }));
         return { ...roadmap, modules: updatedModules };
    }

    const oldStart = new Date(originalTask.startDate).getTime();
    const newStart = new Date(newStartDate).getTime();
    const diffMs = newStart - oldStart;

    let foundMovedTask = false;

    // Shift tasks
    const updatedModules = roadmap.modules.map(mod => {
        const newTasks = mod.tasks.map(t => {
            if (t.id === movedTask.id) {
                foundMovedTask = true;
                // Update the moved task
                return { 
                    ...t, 
                    startDate: newStartDate,
                    endDate: t.endDate ? addTime(t.endDate, diffMs) : undefined
                };
            }

            if (foundMovedTask && t.startDate) {
                // Shift subsequent task
                return {
                    ...t,
                    startDate: addTime(t.startDate, diffMs),
                    endDate: t.endDate ? addTime(t.endDate, diffMs) : undefined
                };
            }
            
            return t;
        });
        return { ...mod, tasks: newTasks };
    });

    // Recalculate total estimate
    const newTotalTime = recalculateTotalTime(updatedModules);

    return {
        ...roadmap,
        modules: updatedModules,
        totalTimeEstimate: newTotalTime
    };
};