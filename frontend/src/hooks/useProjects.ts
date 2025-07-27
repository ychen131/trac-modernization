import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

// Types for Project data
export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  owner_email: string;
  created_at: string;
}

export interface ProjectFormData {
  name: string;
  description: string;
}

interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedProject: Project | null;
  createProject: (projectData: ProjectFormData) => Promise<Project>;
  selectProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  updateProject: (projectId: string, projectData: ProjectFormData) => Promise<Project>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { getToken } = useAuth();

  // Fetch projects from API
  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in.');
      }

      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        if (response.status === 403) {
          throw new Error('Access denied. You don\'t have permission to view projects.');
        }
        if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      return data.projects;
    } catch (err) {
      // If it's already a formatted error message, preserve it
      if (err instanceof Error && (
        err.message.includes('Authentication') ||
        err.message.includes('Access denied') ||
        err.message.includes('Server error')
      )) {
        throw err;
      }
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch projects');
    }
  }, [getToken]);

  // Refresh projects data
  const refreshProjects = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const fetchedProjects = await fetchProjects();
      setProjects(fetchedProjects);
      
      // If no project is selected and we have projects, try to load from localStorage
      if (!selectedProject && fetchedProjects.length > 0) {
        const savedProjectId = localStorage.getItem('selectedProjectId');
        if (savedProjectId) {
          const savedProject = fetchedProjects.find(p => p.id === savedProjectId);
          if (savedProject) {
            setSelectedProject(savedProject);
          } else {
            // If saved project doesn't exist anymore, select the first one
            setSelectedProject(fetchedProjects[0]);
            localStorage.setItem('selectedProjectId', fetchedProjects[0].id);
          }
        } else {
          // No saved project, select the first one
          setSelectedProject(fetchedProjects[0]);
          localStorage.setItem('selectedProjectId', fetchedProjects[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [fetchProjects, selectedProject]);

  // Create new project
  const createProject = useCallback(async (projectData: ProjectFormData): Promise<Project> => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in.');
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Invalid project data');
        }
        if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(`Failed to create project: ${response.statusText}`);
      }

      const data = await response.json();
      const newProject = data.project;
      
      // Add to projects list and select it
      setProjects(prev => [...prev, newProject]);
      setSelectedProject(newProject);
      localStorage.setItem('selectedProjectId', newProject.id);
      
      return newProject;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getToken]);

  // Update project
  const updateProject = useCallback(async (projectId: string, projectData: ProjectFormData): Promise<Project> => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in.');
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        if (response.status === 404) {
          throw new Error('Project not found or access denied.');
        }
        if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(`Failed to update project: ${response.statusText}`);
      }

      const data = await response.json();
      const updatedProject = data.project;
      
      // Update in projects list
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
      
      // Update selected project if it's the one being updated
      if (selectedProject?.id === projectId) {
        setSelectedProject(updatedProject);
      }
      
      return updatedProject;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getToken, selectedProject]);

  // Delete project
  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in.');
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        if (response.status === 404) {
          throw new Error('Project not found or access denied.');
        }
        if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(`Failed to delete project: ${response.statusText}`);
      }

      // Remove from projects list
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      // If this was the selected project, clear selection and localStorage
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        localStorage.removeItem('selectedProjectId');
        
        // Select another project if available
        const remainingProjects = projects.filter(p => p.id !== projectId);
        if (remainingProjects.length > 0) {
          setSelectedProject(remainingProjects[0]);
          localStorage.setItem('selectedProjectId', remainingProjects[0].id);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [getToken, selectedProject, projects]);

  // Select project and persist to localStorage
  const selectProject = useCallback((project: Project | null): void => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem('selectedProjectId', project.id);
      // Trigger page reload as specified in requirements
      window.location.reload();
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  }, []);

  // Load projects on mount
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return {
    projects,
    loading,
    error,
    selectedProject,
    createProject,
    selectProject,
    refreshProjects,
    deleteProject,
    updateProject,
  };
} 