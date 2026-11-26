import React, { useState, useEffect, useRef } from 'react';
import {
  Folder, FolderPlus, UploadCloud, File, FileText, Image as ImageIcon,
  FileSpreadsheet, Trash2, Download, ExternalLink, HardDrive,
  Search, ArrowLeft, RefreshCw, ChevronRight, CheckCircle2,
  AlertCircle, X, Plus, FolderOpen, Database, Eye
} from 'lucide-react';
import { API_BASE_URL } from '../config';

// Utility to format bytes into readable KB/MB/GB
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper to determine file icon by extension
function getFileIcon(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return <ImageIcon size={20} color="#0284C7" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet size={20} color="#16A34A" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return <FileText size={20} color="#EA580C" />;
  }
  return <File size={20} color="#64748B" />;
}

export default function DocStoreHome({ onBackToDashboard }) {
  const [currentFolder, setCurrentFolder] = useState('/');
  const [subfolders, setSubfolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState({ total_files: 0, total_size_bytes: 0, total_folders: 1, r2_active: false });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const [statusBanner, setStatusBanner] = useState(null);

  // New Folder Modal
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Hidden File & Folder Inputs
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const newFolderInputRef = useRef(null);

  // Load files and folders
  const fetchDocStore = async (folder = currentFolder, query = searchQuery) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('folder', folder);
      if (query.trim()) params.append('q', query.trim());
      params.append('_t', Date.now());

      const res = await fetch(`${API_BASE_URL}/api/docs/list?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
        setSubfolders(data.folders || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.warn('Doc Store fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocStore(currentFolder, searchQuery);
  }, [currentFolder]);

  // Handle Search Submission / Typing
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      fetchDocStore(currentFolder, '');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocStore(currentFolder, searchQuery);
  };

  // Upload Files handler
  const handleFileUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgressMsg(`Uploading ${selectedFiles.length} file(s) to Cloudflare R2...`);

    const formData = new FormData();
    formData.append('folder_path', currentFolder);
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/docs/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({ type: 'success', message: data.message || 'Files uploaded to R2 successfully!' });
        fetchDocStore(currentFolder, searchQuery);
      } else {
        setStatusBanner({ type: 'error', message: data.message || 'Upload failed' });
      }
    } catch (err) {
      setStatusBanner({ type: 'error', message: 'Upload network error: ' + err.message });
    } finally {
      setIsUploading(false);
      setUploadProgressMsg('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatusBanner(null), 5000);
    }
  };

  // Upload Directory / Folder handler
  const handleFolderUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgressMsg(`Uploading folder (${selectedFiles.length} files) to Cloudflare R2...`);

    const formData = new FormData();
    formData.append('folder_path', currentFolder);

    const relativePaths = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      formData.append('files', file);
      // Browser provides webkitRelativePath for directory uploads
      relativePaths.push(file.webkitRelativePath || file.name);
    }
    formData.append('relative_paths', JSON.stringify(relativePaths));

    try {
      const res = await fetch(`${API_BASE_URL}/api/docs/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({ type: 'success', message: data.message || 'Folder uploaded to R2 successfully!' });
        fetchDocStore(currentFolder, searchQuery);
      } else {
        setStatusBanner({ type: 'error', message: data.message || 'Folder upload failed' });
      }
    } catch (err) {
      setStatusBanner({ type: 'error', message: 'Folder upload network error: ' + err.message });
    } finally {
      setIsUploading(false);
      setUploadProgressMsg('');
      if (folderInputRef.current) folderInputRef.current.value = '';
      setTimeout(() => setStatusBanner(null), 5000);
    }
  };

  // Create Folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/docs/folder/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_name: cleanName,
          parent_folder: currentFolder
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({ type: 'success', message: data.message });
        setIsNewFolderModalOpen(false);
        setNewFolderName('');
        fetchDocStore(currentFolder, searchQuery);
      } else {
        setStatusBanner({ type: 'error', message: data.message || 'Failed to create folder' });
      }
    } catch (err) {
      setStatusBanner({ type: 'error', message: 'Create folder error: ' + err.message });
    } finally {
      setTimeout(() => setStatusBanner(null), 5000);
    }
  };

  // Delete File
  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.file_name}" from Cloudflare R2?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/docs/file/${encodeURIComponent(file.file_key)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({ type: 'success', message: `"${file.file_name}" deleted from Doc Store.` });
        fetchDocStore(currentFolder, searchQuery);
      } else {
        setStatusBanner({ type: 'error', message: data.message || 'Failed to delete file' });
      }
    } catch (err) {
      setStatusBanner({ type: 'error', message: 'Delete error: ' + err.message });
    } finally {
      setTimeout(() => setStatusBanner(null), 4000);
    }
  };

  // Breadcrumbs builder
  const renderBreadcrumbs = () => {
    const parts = currentFolder.split('/').filter(Boolean);
    return (
      <div className="doc-breadcrumbs">
        <button
          className={`breadcrumb-item ${parts.length === 0 ? 'active' : ''}`}
          onClick={() => setCurrentFolder('/')}
          title="Root directory"
        >
          <FolderOpen size={16} />
          <span>Doc Store (Root)</span>
        </button>

        {parts.map((part, idx) => {
          const pathUpToThis = '/' + parts.slice(0, idx + 1).join('/') + '/';
          const isLast = idx === parts.length - 1;
          return (
            <React.Fragment key={pathUpToThis}>
              <ChevronRight size={14} className="breadcrumb-separator" />
              <button
                className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                onClick={() => setCurrentFolder(pathUpToThis)}
                title={pathUpToThis}
              >
                <span>{part}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="module-page-container animate-fade-in">
      {/* Top Action Bar */}
      <div className="module-top-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <button className="btn-back-dashboard" onClick={onBackToDashboard}>
          <ArrowLeft size={16} />
          <span>Back to All Categories</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {/* Hidden Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={folderInputRef}
            webkitdirectory="true"
            directory="true"
            multiple
            onChange={handleFolderUpload}
            style={{ display: 'none' }}
          />

          {/* Upload Files Button */}
          <button
            className="btn-module-action btn-doc-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Upload one or multiple files into current folder"
          >
            <UploadCloud size={16} />
            <span>+ Upload Files</span>
          </button>

          {/* Upload Folder Button */}
          <button
            className="btn-module-action btn-doc-folder-upload"
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploading}
            title="Upload entire folder directory structure into Cloudflare R2"
          >
            <FolderPlus size={16} />
            <span>📁 Upload Folder</span>
          </button>

          {/* New Folder Button */}
          <button
            className="btn-module-manage btn-doc-new-folder"
            onClick={() => {
              setIsNewFolderModalOpen(true);
              setTimeout(() => newFolderInputRef.current?.focus(), 100);
            }}
            title="Create a new subfolder in current directory"
          >
            <Plus size={16} />
            <span>New Folder</span>
          </button>

          {/* Refresh Button */}
          <button
            className="btn-refresh-data"
            onClick={() => fetchDocStore(currentFolder, searchQuery)}
            title="Refresh Doc Store files and folders"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Uploading progress notification */}
      {isUploading && (
        <div className="doc-upload-banner animate-fade-in">
          <RefreshCw size={18} className="spin" />
          <span>{uploadProgressMsg}</span>
        </div>
      )}

      {/* Notification Banner */}
      {statusBanner && (
        <div className={`doc-status-banner ${statusBanner.type === 'error' ? 'error' : 'success'} animate-fade-in`}>
          {statusBanner.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{statusBanner.message}</span>
          <button className="banner-close-btn" onClick={() => setStatusBanner(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Metrics / Stats Row */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
            <FileText size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total_files || 0}</span>
            <span className="stat-label">Total Files Stored</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <Folder size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total_folders || 1}</span>
            <span className="stat-label">Directories / Folders</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FAF5FF', color: '#9333EA' }}>
            <HardDrive size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatBytes(stats.total_size_bytes)}</span>
            <span className="stat-label">R2 Storage Consumed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
            <Database size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '15px', color: '#059669', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="status-dot-pulse"></span>
              R2 Object Storage
            </span>
            <span className="stat-label">Bucket: survey-doc-store</span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar & Current Directory Navigation */}
      <div className="doc-nav-container">
        {renderBreadcrumbs()}

        <form onSubmit={handleSearchSubmit} className="doc-search-form">
          <div className="search-input-wrapper" style={{ width: '100%', maxWidth: '320px' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search files or folders..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => {
                  setSearchQuery('');
                  fetchDocStore(currentFolder, '');
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Subfolders Grid */}
      {subfolders.length > 0 && !searchQuery && (
        <div className="doc-folders-section">
          <div className="doc-section-title">
            <Folder size={16} />
            <span>Folders ({subfolders.length})</span>
          </div>
          <div className="doc-folders-grid">
            {subfolders.map((folderPath) => {
              const displayName = folderPath.replace(currentFolder, '').replace(/\/$/, '');
              return (
                <div
                  key={folderPath}
                  className="doc-folder-card"
                  onClick={() => setCurrentFolder(folderPath)}
                  title={`Open folder: ${folderPath}`}
                >
                  <div className="folder-card-icon">
                    <Folder size={26} color="#0D9488" />
                  </div>
                  <div className="folder-card-text">
                    <span className="folder-name">{displayName}</span>
                    <span className="folder-meta">Subdirectory</span>
                  </div>
                  <ChevronRight size={16} className="folder-card-arrow" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Table / Empty State */}
      <div className="table-wrapper" style={{ marginTop: '16px' }}>
        {loading ? (
          <div className="table-empty-state">
            <RefreshCw size={36} className="spin empty-icon" />
            <p className="empty-title">Loading Doc Store...</p>
            <p className="empty-desc">Fetching files and folders from Cloudflare R2 object storage.</p>
          </div>
        ) : files.length === 0 && subfolders.length === 0 ? (
          <div className="table-empty-state">
            <FolderOpen size={48} className="empty-icon" />
            <p className="empty-title">This folder is empty</p>
            <p className="empty-desc">
              {searchQuery
                ? `No documents match "${searchQuery}". Try a different keyword.`
                : 'Click "+ Upload Files" or "📁 Upload Folder" above to store files in Cloudflare R2.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'center' }}>
              <button
                className="btn-primary-coral"
                style={{ width: 'auto', padding: '10px 18px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={16} />
                <span>Upload First File</span>
              </button>
            </div>
          </div>
        ) : (
          <table className="survey-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>File Name</th>
                <th>Folder Directory</th>
                <th>Size</th>
                <th>Type</th>
                <th>Uploaded At</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, idx) => (
                <tr key={file.id || file.file_key}>
                  <td style={{ color: '#94A3B8', fontWeight: 600 }}>{idx + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="doc-type-icon">{getFileIcon(file.file_name)}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A', wordBreak: 'break-word' }}>
                          {file.file_name}
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          Key: {file.file_key}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="doc-folder-pill">
                      <Folder size={12} />
                      {file.folder_path || '/'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                    {formatBytes(file.file_size)}
                  </td>
                  <td>
                    <span className="doc-ext-badge">
                      {(file.file_name.split('.').pop() || 'FILE').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ color: '#64748B', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {file.created_at ? new Date(file.created_at).toLocaleDateString() : 'Today'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      {/* Preview in new tab */}
                      <a
                        href={`${API_BASE_URL}/api/docs/file/${encodeURIComponent(file.file_key)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-doc-action"
                        title="Preview / Open in new tab"
                      >
                        <Eye size={15} />
                      </a>

                      {/* Download */}
                      <a
                        href={`${API_BASE_URL}/api/docs/file/${encodeURIComponent(file.file_key)}`}
                        download={file.file_name}
                        className="btn-doc-action"
                        title="Download file"
                      >
                        <Download size={15} />
                      </a>

                      {/* Delete */}
                      <button
                        className="btn-doc-action delete"
                        onClick={() => handleDeleteFile(file)}
                        title="Delete from R2"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsNewFolderModalOpen(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#CCFBF1', color: '#0D9488', padding: '8px', borderRadius: '10px' }}>
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Create New Folder</h3>
                  <p className="modal-subtitle">In: {currentFolder}</p>
                </div>
              </div>
              <button className="btn-close-modal" onClick={() => setIsNewFolderModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFolder}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <label className="form-label" style={{ fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'block' }}>
                  Folder Name *
                </label>
                <input
                  ref={newFolderInputRef}
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '14px' }}
                  placeholder="e.g. Prisoner Cases, Invoices, Proofs"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsNewFolderModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-coral"
                  style={{ width: 'auto', padding: '10px 20px' }}
                  disabled={!newFolderName.trim()}
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
