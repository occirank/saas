import { useState, useEffect } from 'react';
import type { ProjectWithKeywords } from '../types/keywords';

interface ProjectSettingsModalProps {
  project: ProjectWithKeywords;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: { name?: string; domain?: string }) => void;
  onDelete: (id: string) => void;
}

export function ProjectSettingsModal({ project, isOpen, onClose, onUpdate, onDelete }: ProjectSettingsModalProps) {
  const [name, setName] = useState(project.name);
  const [domain, setDomain] = useState(project.domain);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setDomain(project.domain);
      setIsDeleting(false);
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(project.id, { name: name.trim(), domain: domain.trim() });
  };

  const handleDelete = () => {
    if (confirm(`Delete project "${project.name}" and all its keywords? This cannot be undone.`)) {
      setIsDeleting(true);
      onDelete(project.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Project Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Website"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="pt-2 text-xs text-gray-500">
            {project.keywordCount} keyword{project.keywordCount !== 1 ? 's' : ''} tracked
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t border-gray-200 mt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              Delete Project
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
