import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useKeywords } from '../hooks/useKeywords';
import { KeywordsTable } from '../components/KeywordsTable';
import { AddKeywordModal } from '../components/AddKeywordModal';
import { KeywordDetailModal } from '../components/KeywordDetailModal';
import { ProjectSettingsModal } from '../components/ProjectSettingsModal';
import type { CreateKeywordRequest, KeywordWithRanking } from '../types/keywords';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function KeywordsPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  
  const {
    projects,
    keywords,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    addKeyword,
    deleteKeyword,
    checkKeyword,
    selectProject,
    clearError,
  } = useKeywords();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordWithRanking | null>(null);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDomain, setNewProjectDomain] = useState('');

  const currentProject = projectId ? projects.find(p => p.id === projectId) : null;

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (currentProject && currentProject.keywords) {
      selectProject(currentProject);
    }
  }, [currentProject, selectProject]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectDomain.trim()) return;

    try {
      const project = await createProject(newProjectName.trim(), newProjectDomain.trim());
      if (project) {
        navigate(`/keywords/${project.id}`);
      }
      setNewProjectName('');
      setNewProjectDomain('');
      setIsCreateProjectOpen(false);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleAddKeyword = async (data: CreateKeywordRequest) => {
    await addKeyword(data);
  };

  const handleUpdateProject = async (id: string, data: { name?: string; domain?: string }) => {
    const updated = await updateProject(id, data);
    if (updated) {
      fetchProjects();
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project and all its keywords?')) {
      await deleteProject(id);
      setIsProjectSettingsOpen(false);
      navigate('/keywords');
    }
  };

  if (error && !currentProject) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Projects</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={() => {
            clearError();
            fetchProjects();
          }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (projects.length === 0 && !isLoading) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h2>
        <p className="text-gray-500 mb-6">Create your first project to start tracking keywords.</p>
        <button
          onClick={() => setIsCreateProjectOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg"
        >
          Create Project
        </button>

        {isCreateProjectOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Create Project</h3>
                <button onClick={() => setIsCreateProjectOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="My Website"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                  <input
                    type="text"
                    value={newProjectDomain}
                    onChange={(e) => setNewProjectDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateProjectOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentProject) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/keywords"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to projects"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentProject.name}</h1>
              <p className="text-gray-500 mt-1">
                {currentProject.domain} · {keywords.length} keywords
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsProjectSettingsOpen(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Settings
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              + Add Keyword
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {isLoading && keywords.length === 0 ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-gray-500">Loading keywords...</p>
          </div>
        ) : (
          <KeywordsTable
            keywords={keywords}
            isLoading={isLoading}
            onCheck={checkKeyword}
            onDelete={deleteKeyword}
            onRowClick={setSelectedKeyword}
          />
        )}

        <KeywordDetailModal
          keyword={selectedKeyword}
          isOpen={!!selectedKeyword}
          onClose={() => setSelectedKeyword(null)}
          onCheck={checkKeyword}
          onDelete={deleteKeyword}
        />

        <AddKeywordModal
          projectId={currentProject.id}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddKeyword}
        />

        <ProjectSettingsModal
          project={currentProject}
          isOpen={isProjectSettingsOpen}
          onClose={() => setIsProjectSettingsOpen(false)}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Keyword Tracking</h1>
          <p className="text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setIsCreateProjectOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + New Project
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading projects...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keywords</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((project, index) => (
                  <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500 font-medium">{index + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/keywords/${project.id}`}
                        className="text-primary-600 hover:text-primary-800 hover:underline font-medium"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{project.domain}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {project.keywordCount} keywords
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(project.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          to={`/keywords/${project.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100 transition-colors"
                          title="View Keywords"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => {
                            selectProject(project);
                            setIsProjectSettingsOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                          title="Settings"
                        >
                          Settings
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this project and all its keywords?')) {
                              deleteProject(project.id);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                          title="Delete Project"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isCreateProjectOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Project</h3>
              <button onClick={() => setIsCreateProjectOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Website"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                <input
                  type="text"
                  value={newProjectDomain}
                  onChange={(e) => setNewProjectDomain(e.target.value)}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateProjectOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
