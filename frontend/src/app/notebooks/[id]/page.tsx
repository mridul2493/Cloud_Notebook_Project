'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NotebookEditor({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; type: string; dataUrl: string }>>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [textRef, setTextRef] = useState<HTMLTextAreaElement | null>(null);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const load = async () => {
      try {
        setIsLoading(true);
        setError('');
        const resp = await fetch(`/api/notebooks/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) {
          const e = await resp.json().catch(() => ({} as any));
          throw new Error(e?.error?.message || 'Failed to load notebook');
        }
        const data = await resp.json();
        setTitle(data.notebook?.title || 'Untitled');
        const content = data.notebook?.content || {};
        setBody((content.body as string) || '');
        const loadedAtts = Array.isArray(content.attachments) ? content.attachments : [];
        setAttachments(
          loadedAtts
            .filter((a: any) => a && a.name && a.type && a.dataUrl)
            .map((a: any) => ({ id: a.id || `${Date.now()}-${Math.random()}`, name: a.name, type: a.type, dataUrl: a.dataUrl }))
        );
      } catch (err: any) {
        setError(err?.message || 'Failed to load notebook');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id, router]);

  const loadVersionHistory = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const resp = await fetch(`/api/notebooks/${id}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setVersions(data.versions || []);
      }
    } catch (e) {
      console.error('Failed to load version history:', e);
    }
  };

  const restoreVersion = async (version: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!confirm(`Are you sure you want to restore to version ${version}? This will overwrite the current content.`)) {
      return;
    }

    try {
      setSaving(true);
      const resp = await fetch(`/api/notebooks/${id}/versions/${version}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (resp.ok) {
        setMessage(`Restored to version ${version}`);
        // Reload the notebook content
        const loadResp = await fetch(`/api/notebooks/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (loadResp.ok) {
          const data = await loadResp.json();
          setTitle(data.notebook?.title || 'Untitled');
          const content = data.notebook?.content || {};
          setBody((content.body as string) || '');
          const loadedAtts = Array.isArray(content.attachments) ? content.attachments : [];
          setAttachments(loadedAtts.filter((a: any) => a && a.name && a.type && a.dataUrl));
        }
        loadVersionHistory();
      } else {
        const e = await resp.json().catch(() => ({} as any));
        setError(e?.error?.message || 'Failed to restore version');
      }
    } catch (e) {
      setError('Failed to restore version');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const resp = await fetch(`/api/notebooks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          content: { body, attachments }
        })
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({} as any));
        throw new Error(e?.error?.message || 'Failed to save notebook');
      }
      setMessage('Saved');
      setTimeout(() => setMessage(''), 1500);
      // Refresh version history if it's open
      if (showVersionHistory) {
        loadVersionHistory();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save notebook');
    } finally {
      setSaving(false);
    }
  };

  const wrapSelection = (wrapperLeft: string, wrapperRight?: string) => {
    const el = textRef;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const before = body.slice(0, start);
    const selected = body.slice(start, end);
    const after = body.slice(end);
    const right = wrapperRight === undefined ? wrapperLeft : wrapperRight;
    const newText = `${before}${wrapperLeft}${selected || ''}${right}${after}`;
    setBody(newText);
    // restore selection roughly
    setTimeout(() => {
      try {
        const pos = start + wrapperLeft.length + (selected ? selected.length : 0);
        el.focus();
        el.setSelectionRange(pos, pos);
      } catch {}
    }, 0);
  };

  const handleAddAttachmentClick = () => {
    fileInputRef?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    for (const f of list) {
      const ok = f.type.startsWith('image/') || f.type === 'application/pdf';
      if (!ok) {
        setError('Only images and PDFs are allowed');
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(f);
      });
      setAttachments(prev => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, name: f.name, type: f.type, dataUrl }
      ]);
    }
    // reset input
    if (fileInputRef) fileInputRef.value = '' as any;
  };

  const removeAttachment = (idToRemove: string) => {
    setAttachments(prev => prev.filter(a => a.id !== idToRemove));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-3 py-2 text-sm rounded-md border hover:bg-gray-50"
            >
              ← Back
            </button>
            <input
            className="w-full mr-4 text-xl font-semibold outline-none bg-transparent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-2">
          <button onClick={() => wrapSelection('**')} className="px-3 py-1 text-sm rounded border hover:bg-gray-50" title="Bold">B</button>
          <button onClick={() => wrapSelection('_')} className="px-3 py-1 text-sm rounded border hover:bg-gray-50" title="Italic">I</button>
          <button onClick={handleAddAttachmentClick} className="px-3 py-1 text-sm rounded border hover:bg-gray-50" title="Attach files">Attach</button>
          <button 
            onClick={() => {
              setShowVersionHistory(!showVersionHistory);
              if (!showVersionHistory) loadVersionHistory();
            }} 
            className="px-3 py-1 text-sm rounded border hover:bg-gray-50" 
            title="Version History"
          >
            📚 History
          </button>
          <input ref={setFileInputRef} onChange={handleFilesSelected} type="file" multiple accept="image/*,application/pdf" className="hidden" />
        </div>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto mt-4 px-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
        </div>
      )}
      {message && (
        <div className="max-w-5xl mx-auto mt-4 px-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">{message}</div>
        </div>
      )}

      {showVersionHistory && (
        <div className="max-w-5xl mx-auto mt-4 px-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Version History</h3>
            {versions.length === 0 ? (
              <p className="text-gray-500">No version history available</p>
            ) : (
              <div className="space-y-2">
                {versions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">Version {version.version}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(version.created_at).toLocaleString()} • 
                        {version.action} by {version.contributorName || version.contributor}
                      </div>
                      {version.metadata?.changeType && (
                        <div className="text-xs text-blue-600">{version.metadata.changeType}</div>
                      )}
                    </div>
                    <button
                      onClick={() => restoreVersion(version.version)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {attachments.length > 0 && (
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attachments.map(att => (
              <div key={att.id} className="border rounded p-3 bg-white flex items-center gap-3">
                {att.type.startsWith('image/') ? (
                  <img src={att.dataUrl} alt={att.name} className="w-16 h-16 object-cover rounded" />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded text-gray-500">PDF</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{att.name}</div>
                  <div className="text-xs text-gray-500 truncate">{att.type}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={att.dataUrl} download={att.name} className="text-blue-600 text-sm hover:underline">Download</a>
                  <a href={att.dataUrl} target="_blank" rel="noreferrer" className="text-gray-600 text-sm hover:underline">View</a>
                  <button onClick={() => removeAttachment(att.id)} className="text-red-500 text-sm">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <textarea
          className="w-full min-h-[60vh] p-4 bg-white rounded-lg border outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Start writing…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          ref={setTextRef}
        />
      </main>
    </div>
  );
}


