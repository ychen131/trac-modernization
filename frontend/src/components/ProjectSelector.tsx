import React, { useState } from 'react';
import { Project, useProjects } from '../hooks/useProjects';
import { ProjectCreateModal } from './ProjectCreateModal';
import './ProjectSelector.css';

interface ProjectSelectorProps {
  className?: string;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ className = '' }) => {
  const {
    projects,
    loading,
    error,
    selectedProject,
    createProject,
    selectProject,
  } = useProjects();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleProjectSelect = (project: Project) => {
    selectProject(project);
    setIsDropdownOpen(false);
  };

  const handleCreateProject = async (projectData: { name: string; description: string }) => {
    try {
      setCreateLoading(true);
      setCreateError(null);
      await createProject(projectData);
      // Modal will close automatically on success via the useProjects hook
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
      throw err; // Re-throw to prevent modal from closing
    } finally {
      setCreateLoading(false);
    }
  };

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    setIsDropdownOpen(false);
    setCreateError(null);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateError(null);
  };

  if (loading) {
    return (
      <div className={`project-selector ${className}`}>
        <div className="project-selector-button loading">
          <span className="project-name">Loading projects...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`project-selector ${className}`}>
        <div className="project-selector-button error">
          <span className="project-name">Error loading projects</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`project-selector ${className}`}>
        <div
          className={`project-selector-button ${isDropdownOpen ? 'open' : ''}`}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsDropdownOpen(!isDropdownOpen);
            }
          }}
        >
          <div className="project-info">
            <span className="project-name">
              {selectedProject ? selectedProject.name : 'Select Project'}
            </span>
            {selectedProject && selectedProject.description && (
              <span className="project-description">
                {selectedProject.description}
              </span>
            )}
          </div>
          <div className="dropdown-arrow">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {isDropdownOpen && (
          <div className="project-dropdown">
            <div className="dropdown-content">
              {projects.length > 0 ? (
                <>
                  <div className="dropdown-section">
                    <div className="dropdown-section-title">Your Projects</div>
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className={`dropdown-item ${
                          selectedProject?.id === project.id ? 'selected' : ''
                        }`}
                        onClick={() => handleProjectSelect(project)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleProjectSelect(project);
                          }
                        }}
                      >
                        <div className="project-item-info">
                          <div className="project-item-name">{project.name}</div>
                          {project.description && (
                            <div className="project-item-description">
                              {project.description}
                            </div>
                          )}
                        </div>
                        {selectedProject?.id === project.id && (
                          <div className="selected-indicator">✓</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="dropdown-divider"></div>
                </>
              ) : (
                <div className="dropdown-section">
                  <div className="empty-state">
                    <div className="empty-state-icon">📁</div>
                    <div className="empty-state-text">No projects yet</div>
                    <div className="empty-state-subtext">
                      Create your first project to get started
                    </div>
                  </div>
                </div>
              )}
              
              <div className="dropdown-section">
                <div
                  className="dropdown-item create-item"
                  onClick={openCreateModal}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openCreateModal();
                    }
                  }}
                >
                  <div className="create-icon">+</div>
                  <span>Create New Project</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <ProjectCreateModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onSubmit={handleCreateProject}
        loading={createLoading}
        error={createError}
      />

      {/* Overlay to close dropdown when clicking outside */}
      {isDropdownOpen && (
        <div
          className="dropdown-overlay"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </>
  );
}; 