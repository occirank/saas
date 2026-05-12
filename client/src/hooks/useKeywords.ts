import { useState, useCallback } from 'react';
import type {
  KeywordWithRanking,
  CreateKeywordRequest,
  ProjectWithKeywords
} from '../types/keywords';

const API = '/api/keywords';

export function useKeywords() {
  const [projects, setProjects] = useState<ProjectWithKeywords[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectWithKeywords | null>(null);
  const [keywords, setKeywords] = useState<KeywordWithRanking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = async (name: string, domain: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain }),
      });
      const project = await res.json();
      fetchProjects();
      return project;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const addKeyword = async (data: CreateKeywordRequest) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const kw = await res.json();
      setKeywords(prev => [...prev, kw]);
      return kw;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteKeyword = async (id: string) => {
    setIsLoading(true);
    try {
      await fetch(`${API}/keywords/${id}`, { method: 'DELETE' });
      setKeywords(prev => prev.filter(k => k.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const checkKeyword = async (id: string) => {
    setIsLoading(true);
    setError(null);
    console.log('[checkKeyword] Starting check for:', id);
    try {
      const res = await fetch(`${API}/keywords/${id}/check`, { method: 'POST' });
      console.log('[checkKeyword] Response status:', res.status);
      const result = await res.json();
      console.log('[checkKeyword] Response data:', result);
      
      if (!res.ok) {
        throw new Error(result.error || result.hint || 'Failed to check keyword');
      }
      
      setKeywords(prev => {
        const updated = prev.map(k => {
          if (k.id === id) {
            const updatedRanking = k.latestRanking 
              ? { ...k.latestRanking, position: result.position, urlFound: result.url, checkedAt: result.checkedAt } 
              : { id: '', keywordId: id, position: result.position, previousPosition: null, urlFound: result.url, searchVolume: null, difficulty: null, checkedAt: result.checkedAt };
            const updatedKeyword = { 
              ...k, 
              lastCheckedAt: result.checkedAt,
              latestRanking: updatedRanking 
            } as KeywordWithRanking;
            console.log('[checkKeyword] Updated keyword:', updatedKeyword);
            return updatedKeyword;
          }
          return k;
        });
        console.log('[checkKeyword] Full updated list:', updated);
        return updated;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to check keyword';
      console.error('[checkKeyword] Error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectProject = (p: ProjectWithKeywords | null) => {
    setCurrentProject(p);
    if (p?.keywords) {
      setKeywords(p.keywords);
    } else {
      setKeywords([]);
    }
  };

  const updateProject = async (id: string, data: { name?: string; domain?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      if (!res.ok) {
        throw new Error(updated.error || 'Failed to update project');
      }
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
      if (currentProject?.id === id) {
        setCurrentProject(prev => prev ? { ...prev, ...updated } : null);
      }
      return updated;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update project';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete project');
      }
      setProjects(prev => prev.filter(p => p.id !== id));
      if (currentProject?.id === id) {
        const remaining = projects.filter(p => p.id !== id);
        if (remaining.length > 0) {
          setCurrentProject(remaining[0]);
          setKeywords(remaining[0].keywords || []);
        } else {
          setCurrentProject(null);
          setKeywords([]);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete project';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    projects,
    currentProject,
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
  };
}
