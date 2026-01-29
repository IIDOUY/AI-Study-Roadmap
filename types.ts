
export interface Collaborator {
  email: string;
  role: 'owner' | 'editor';
  status?: 'pending' | 'accepted'; // Add status
}

export interface LastEditedBy {
  email: string;
  at: string; // ISO Date
}

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
  notes?: string;
  lastEditedBy?: LastEditedBy;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  isCompleted: boolean;
  completedAt?: string; // ISO Date of completion
  priority: 'High' | 'Medium' | 'Low';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  notes?: string;
  subTasks?: SubTask[];
  resources?: Resource[];
  lastEditedBy?: LastEditedBy;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  tasks: Task[];
  isExpanded?: boolean; // UI state
}

export interface Roadmap {
  id?: string; // Unique ID for storage
  createdAt?: string;
  title: string;
  description: string;
  totalTimeEstimate: string;
  modules: Module[];
  user_id?: string;
  owner_email?: string; // For display in shared views
  collaborators?: Collaborator[];
}

export interface AINotification {
  id: string;
  title: string;
  message: string;
  type: 'celebration' | 'insight' | 'encouragement' | 'warning';
  actionLabel?: string; // e.g., "Thanks!", "I'm back"
  onAction?: () => void;
}

// New Interface for Pending Invites
export interface ProjectInvitation {
    id: string; // member table id
    roadmap_id: string;
    roadmap_title?: string; // Joined title
    invited_by?: string; // Legacy fallback
    sender_name?: string; // Full name of inviter
    sender_email?: string; // Email of inviter
    added_at: string;
}

export interface UserPreferences {
  darkMode: boolean;
  emailNotifications: boolean;
  focusTimerMinutes: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  is_pro?: boolean; // Added is_pro
  preferences: UserPreferences;
}

export enum AppState {
  HOME = 'HOME',
  AUTH = 'AUTH',
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  DASHBOARD = 'DASHBOARD',
  PROFILE = 'PROFILE',
  ERROR = 'ERROR'
}