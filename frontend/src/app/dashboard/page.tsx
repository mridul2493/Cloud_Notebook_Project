'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showShareForId, setShowShareForId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/auth/login';
        return;
      }

      try {
        setIsLoading(true);
        setError('');

        // Optionally, fetch the current user profile here in the future
        setUser({});

        const resp = await fetch('/api/notebooks', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) {
          const e = await resp.json().catch(() => ({} as any));
          throw new Error(e?.error?.message || 'Failed to load notebooks');
        }
        const data = await resp.json();
        setNotebooks(data.notebooks || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load notebooks');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const openShare = async (notebookId: string) => {
    setShowShareForId(notebookId);
    setSelectedIds({});
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({} as any));
        throw new Error(e?.error?.message || 'Failed to load users');
      }
      const data = await resp.json();
      setAllUsers(data.users || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load users');
    }
  };

  const applyShare = async () => {
    if (!showShareForId) return;
    
    const selectedUserIds = Object.keys(selectedIds).filter(id => selectedIds[id]);
    if (selectedUserIds.length === 0) {
      setError('Please select at least one user to share with');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setError('');
      const resp = await fetch(`/api/notebooks/${showShareForId}/collaborate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          collaboratorIds: selectedUserIds
        })
      });

      if (!resp.ok) {
        const e = await resp.json().catch(() => ({} as any));
        throw new Error(e?.error?.message || 'Failed to share notebook');
      }

      setShowShareForId(null);
      setSelectedIds({});
      
      // Refresh notebooks to show updated collaborators
      const notebooksResp = await fetch('/api/notebooks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (notebooksResp.ok) {
        const data = await notebooksResp.json();
        setNotebooks(data.notebooks || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to share notebook');
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setShowSearchResults(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setIsSearching(true);
      setError('');
      const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({} as any));
        throw new Error(e?.error?.message || 'Search failed');
      }
      const data = await resp.json();
      setSearchResults(data.results || []);
      setShowSearchResults(true);
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const handleCreateNotebook = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    const title = window.prompt('Notebook title', 'Untitled Notebook');
    if (!title) return;

    try {
      setError('');
      const resp = await fetch('/api/notebooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          content: {},
          subject: '',
          course: '',
          tags: []
        })
      });

      if (!resp.ok) {
        const e = await resp.json().catch(() => ({} as any));
        throw new Error(e?.error?.message || 'Failed to create notebook');
      }

      const data = await resp.json();
      const created = data.notebook;
      setNotebooks((prev) => [created, ...prev]);
      if (created?.id) {
        window.location.href = `/notebooks/${created.id}`;
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create notebook');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl mr-2">🎓</span>
              <h1 className="text-xl font-semibold text-gray-900">Academic Notebook</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Manage your academic notebooks and collaborate with peers</p>
          
          {/* Search Bar */}
          <div className="mt-6">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Search notebooks, content, attachments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">📚</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Notebooks</p>
                <p className="text-2xl font-semibold text-gray-900">{notebooks.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Collaborations</p>
                <p className="text-2xl font-semibold text-gray-900">3</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-2xl">⚡</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                <p className="text-2xl font-semibold text-gray-900">Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {showSearchResults && (
          <div className="mb-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Search Results for "{searchQuery}" ({searchResults.length} found)
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No results found. Try different keywords.
                </div>
              ) : (
                searchResults.map((result: any) => (
                  <div key={result.notebookId} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900 mb-1">
                          {result.notebook?.title}
                        </h4>
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
                            Score: {Math.round(result.score * 100)}%
                          </span>
                          <span className="text-xs text-gray-500">
                            Matched: {result.matchedFields?.join(', ')}
                          </span>
                        </div>
                        {result.highlights && result.highlights.length > 0 && (
                          <div className="text-sm text-gray-700 mb-2">
                            {result.highlights.map((highlight: string, idx: number) => (
                              <span key={idx} className="bg-yellow-100 px-1 rounded">
                                {highlight}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Updated: {new Date(result.notebook?.updated_at).toLocaleDateString()}</span>
                          {result.notebook?.subject && <span>Subject: {result.notebook.subject}</span>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => window.location.href = `/notebooks/${result.notebookId}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Notebooks Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">My Notebooks</h3>
            <button onClick={handleCreateNotebook} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              + New Notebook
            </button>
          </div>

          {error && (
            <div className="px-6 py-3 text-sm text-red-700 bg-red-50 border-t border-red-100">{error}</div>
          )}

          <div className="divide-y divide-gray-200">
            {notebooks.map((notebook: any) => (
              <div key={notebook.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 mb-1">
                      {notebook.title}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Subject: {notebook.subject}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>
                        Updated: {new Date(notebook.updated_at).toLocaleDateString()}
                      </span>
                      <span>
                        Collaborators: {notebook.collaborators.join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium" onClick={() => {
                      if (notebook?.id) {
                        window.location.href = `/notebooks/${notebook.id}`;
                      }
                    }}>
                      Open
                    </button>
                    <button className="text-gray-400 hover:text-gray-600 text-sm" onClick={() => openShare(notebook.id)}>
                      Share
                    </button>
                    <button
                      className="text-red-500 hover:text-red-700 text-sm"
                      onClick={async () => {
                        if (!notebook?.id) return;
                        if (!confirm('Delete this notebook?')) return;
                        try {
                          const token = localStorage.getItem('token');
                          const resp = await fetch(`/api/notebooks/${notebook.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          if (!resp.ok) {
                            const e = await resp.json().catch(() => ({} as any));
                            throw new Error(e?.error?.message || 'Failed to delete');
                          }
                          setNotebooks(prev => prev.filter(n => n.id !== notebook.id));
                        } catch (e: any) {
                          setError(e?.message || 'Failed to delete');
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {notebooks.length === 0 && (
            <div className="p-12 text-center">
              <span className="text-6xl mb-4 block">📝</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notebooks yet</h3>
              <p className="text-gray-600 mb-4">Create your first academic notebook to get started</p>
              <button onClick={handleCreateNotebook} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Create Your First Notebook
              </button>
            </div>
          )}
        </div>

        {/* Features Demo */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">🚀 Platform Features</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Real-time collaboration
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Automatic backup & versioning
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                AI-powered search
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Academic-focused tools
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">📊 Research Impact</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Research gaps addressed:</span>
                <span className="font-medium text-green-600">3/3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">AWS services integrated:</span>
                <span className="font-medium text-blue-600">8+</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Security layers:</span>
                <span className="font-medium text-purple-600">5+</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showShareForId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">Share Notebook</h4>
              <button onClick={() => setShowShareForId(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="max-h-72 overflow-auto border rounded">
              {allUsers.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No users found</div>
              )}
              {allUsers.map(u => (
                <label key={u.id} className="flex items-center gap-3 p-3 border-b last:border-b-0">
                  <input
                    type="checkbox"
                    checked={!!selectedIds[u.id]}
                    onChange={(e) => setSelectedIds(prev => ({ ...prev, [u.id]: e.target.checked }))}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{u.name || u.email}</span>
                    <span className="text-xs text-gray-500">{u.email}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowShareForId(null)} className="px-4 py-2 rounded border">Cancel</button>
              <button onClick={applyShare} className="px-4 py-2 rounded bg-blue-600 text-white">Share</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
