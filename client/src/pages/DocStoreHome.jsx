import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Folder, FolderPlus, UploadCloud, File, FileText, Image as ImageIcon,
  FileSpreadsheet, Trash2, Download, HardDrive,
  Search, ArrowLeft, RefreshCw, ChevronRight, CheckCircle2,
  AlertCircle, X, Plus, FolderOpen, Database, Eye, ArrowUpLeft
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
    return <ImageIcon size={19} color="#0284C7" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet size={19} color="#16A34A" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return <FileText size={19} color="#EA580C" />;
  }
  return <File size={19} color="#64748B" />;
}

export default function DocStoreHome({ onBackToDashboard }) {
  const [currentFolder, setCurrentFolder] = useState('/');
  const [subfolders, setSubfolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState({ total_files: 0, total_size_bytes: 0, total_folders: 1, r2_active: true });
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

  // Escape key handler for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isNewFolderModalOpen) {
        setIsNewFolderModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewFolderModalOpen]);

  // Load files and folders from Cloudflare Database / R2
  const fetchDocStore = async (folder = currentFolder, query = searchQuery) => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const params = new URLSearchParams();
      params.append('folder', folder);
      if (query.trim()) params.append('q', query.trim());
      params.append('_t', Date.now());

      const res = await fetch(`${API_BASE_URL}/api/docs/list?${params.toString()}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.status === 404) {
        setStatusBanner({
          type: 'error',
          message: 'Worker R2 API endpoint not active yet. Please deploy the updated worker.js in Cloudflare Dashboard.'
        });
        setFiles([]);
        setSubfolders([]);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
        setSubfolders(data.folders || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        setFiles([]);
        setSubfolders([]);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Doc Store fetch error:', err);
      // Fail gracefully without locking UI
      setFiles([]);
      setSubfolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocStore(currentFolder, searchQuery);
  }, [currentFolder]);

  // Handle Search Input
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

  // Upload Files (Single / Multi)
  const handleFileUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgressMsg(`Uploading ${selectedFiles.length} file(s) directly to Cloudflare R2...`);

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
        setStatusBanner({ type: 'success', message: data.message || 'Files uploaded to Cloudflare R2 successfully!' });
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
      setTimeout(() => setStatusBanner(null), 6000);
    }
  };

  // Upload Folder (Directory batch upload)
  const handleFolderUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgressMsg(`Uploading folder directory (${selectedFiles.length} files) to Cloudflare R2...`);

    const formData = new FormData();
    formData.append('folder_path', currentFolder);

    const relativePaths = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const relPath = file.webkitRelativePath || file.name;
      // 3rd arg ensures browser does not pass folder slash inside file.name
      formData.append('files', file, file.name);
      formData.append('rel_paths', relPath);
      relativePaths.push(relPath);
    }
    formData.append('relative_paths', JSON.stringify(relativePaths));

    try {
      const res = await fetch(`${API_BASE_URL}/api/docs/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({ type: 'success', message: data.message || 'Folder uploaded to Cloudflare R2 successfully!' });
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
      setTimeout(() => setStatusBanner(null), 6000);
    }
  };

  // Create New Subfolder
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

  // Delete File from R2 & Database
  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${file.file_name}" from Cloudflare R2?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/docs/file/${encodeURIComponent(file.file_key)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({ type: 'success', message: `"${file.file_name}" deleted from Cloudflare R2.` });
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

  // Delete Entire Folder from R2 & Database
  const handleDeleteFolder = async (folderPath) => {
    const folderDisplay = folderPath.replace(currentFolder, '').replace(/\/$/, '') || folderPath;
    if (!window.confirm(`Are you sure you want to permanently delete folder "${folderDisplay}" and ALL its files from Cloudflare R2?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/docs/folder`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath })
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({ type: 'success', message: data.message });
        fetchDocStore(currentFolder, searchQuery);
      } else {
        setStatusBanner({ type: 'error', message: data.message || 'Failed to delete folder' });
      }
    } catch (err) {
      setStatusBanner({ type: 'error', message: 'Delete folder error: ' + err.message });
    } finally {
      setTimeout(() => setStatusBanner(null), 5000);
    }
  };

  // Download Entire Folder (downloads all files inside sequentially)
  const handleDownloadFolder = async (folderPath) => {
    try {
      setStatusBanner({ type: 'success', message: `Fetching files in "${folderPath}" for download...` });
      const res = await fetch(`${API_BASE_URL}/api/docs/folder/files?folder_path=${encodeURIComponent(folderPath)}&_t=${Date.now()}`);
      const data = await res.json();

      if (!data.success || !Array.isArray(data.files) || data.files.length === 0) {
        alert('No files found inside this folder to download.');
        return;
      }

      setStatusBanner({ type: 'success', message: `Downloading ${data.files.length} file(s) from "${folderPath}"...` });

      // Trigger sequential download of each file
      for (let i = 0; i < data.files.length; i++) {
        const f = data.files[i];
        const link = document.createElement('a');
        link.href = `${API_BASE_URL}/api/docs/file/${encodeURIComponent(f.file_key)}`;
        link.download = f.file_name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(r => setTimeout(r, 600)); // Short pause between downloads
      }
    } catch (err) {
      setStatusBanner({ type: 'error', message: 'Folder download error: ' + err.message });
    }
  };

  // Navigate to Parent Directory
  const handleGoUp = () => {
    if (currentFolder === '/') return;
    const parts = currentFolder.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.length === 0 ? '/' : '/' + parts.join('/') + '/';
    setCurrentFolder(parentPath);
  };

  const folderParts = currentFolder.split('/').filter(Boolean);

  return (
    <div className="survey-page-container animate-fade-in">
      {/* 1. Top Navigation Bar (Identical to Web Review / Work Role) */}
      <div className="page-top-nav">
        <button className="btn-back-nav" onClick={onBackToDashboard}>
          <ArrowLeft size={16} />
          <span>Back to All Categories</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-back-nav"
            onClick={() => fetchDocStore(currentFolder, searchQuery)}
            title="Refresh Data from Cloudflare R2"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Quick Stats Banner (Horizontal 4-card grid) */}
      <div className="stats-banner" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon green">
            <FileText size={22} />
          </div>
          <div>
            <div className="stat-value">{stats.total_files || 0}</div>
            <div className="stat-label">Total Files Stored</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Folder size={22} />
          </div>
          <div>
            <div className="stat-value">{stats.total_folders || 1}</div>
            <div className="stat-label">Directories / Folders</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <HardDrive size={22} />
          </div>
          <div>
            <div className="stat-value">{formatBytes(stats.total_size_bytes)}</div>
            <div className="stat-label">R2 Storage Consumed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Database size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '15px', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="status-dot-pulse"></span>
              Live R2 Storage
            </div>
            <div className="stat-label">Bucket: survey-doc-store</div>
          </div>
        </div>
      </div>

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

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="doc-upload-banner animate-fade-in">
          <RefreshCw size={18} className="animate-spin" />
          <span>{uploadProgressMsg}</span>
        </div>
      )}

      {/* 3. Actions and Search Bar (Matching other modules) */}
      <div className="survey-action-bar">
        {/* Hidden File & Folder Inputs */}
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

        {/* Buttons Group */}
        <div className="action-buttons-group">
          {/* Upload Files */}
          <button
            className="btn-add-data"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Upload single or multiple files to Cloudflare R2"
          >
            <UploadCloud size={18} />
            <span>Upload Files</span>
          </button>

          {/* Upload Folder */}
          <button
            className="btn-download-excel"
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploading}
            style={{ background: '#0284C7', borderColor: '#0369A1' }}
            title="Upload entire folder directory structure"
          >
            <FolderPlus size={18} />
            <span>Upload Folder</span>
          </button>

          {/* Create New Folder */}
          <button
            className="btn-case-types"
            onClick={() => {
              setIsNewFolderModalOpen(true);
              setTimeout(() => newFolderInputRef.current?.focus(), 100);
            }}
            title="Create a new directory"
          >
            <Plus size={17} />
            <span>New Folder</span>
          </button>
        </div>

        {/* Search Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 320px', justifyContent: 'flex-end' }}>
          <form onSubmit={handleSearchSubmit} className="search-container" style={{ margin: 0, minWidth: '220px', flex: '1 1 240px' }}>
            <Search size={18} className="search-icon" />
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
          </form>
        </div>
      </div>

      {/* 4. Breadcrumb Navigation Bar */}
      <div className="doc-nav-container" style={{ margin: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div className="doc-breadcrumbs">
          <button
            className={`breadcrumb-item ${folderParts.length === 0 ? 'active' : ''}`}
            onClick={() => setCurrentFolder('/')}
            title="Root Directory"
          >
            <FolderOpen size={15} />
            <span>Doc Store (Root)</span>
          </button>

          {folderParts.map((part, idx) => {
            const pathUpToThis = '/' + folderParts.slice(0, idx + 1).join('/') + '/';
            const isLast = idx === folderParts.length - 1;
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

        {/* Current Folder Action Buttons */}
        {currentFolder !== '/' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-folder-action"
              onClick={handleGoUp}
              title="Go up to parent folder"
            >
              <ArrowUpLeft size={14} />
              <span>Up One Level</span>
            </button>
            <button
              className="btn-folder-action"
              onClick={() => handleDownloadFolder(currentFolder)}
              title="Download all files in current folder"
            >
              <Download size={14} />
              <span>Download Folder</span>
            </button>
            <button
              className="btn-folder-action delete"
              onClick={() => {
                handleDeleteFolder(currentFolder);
                handleGoUp();
              }}
              title="Delete current folder"
            >
              <Trash2 size={14} />
              <span>Delete Folder</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Subfolders Section */}
      {subfolders.length > 0 && !searchQuery && (
        <div className="doc-folders-section" style={{ marginBottom: '18px' }}>
          <div className="doc-section-title">
            <Folder size={17} color="#0D9488" />
            <span>Folders & Directories ({subfolders.length})</span>
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
                    <Folder size={24} color="#0D9488" />
                  </div>
                  <div className="folder-card-text">
                    <span className="folder-name">{displayName}</span>
                    <span className="folder-meta">Subdirectory</span>
                  </div>

                  {/* Actions for folder: Download & Delete */}
                  <div className="folder-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-folder-mini-action"
                      onClick={() => handleDownloadFolder(folderPath)}
                      title={`Download all files in "${displayName}"`}
                    >
                      <Download size={13} />
                    </button>
                    <button
                      className="btn-folder-mini-action delete"
                      onClick={() => handleDeleteFolder(folderPath)}
                      title={`Delete folder "${displayName}"`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Files Table */}
      <div className="table-wrapper" style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: '16px' }}>
        {loading ? (
          <div className="table-empty-state">
            <RefreshCw size={36} className="animate-spin empty-icon" />
            <p className="empty-title">Loading Doc Store...</p>
            <p className="empty-desc">Connecting to Cloudflare R2 object storage...</p>
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
          <div style={{ overflowX: 'auto', background: '#FFFFFF' }}>
            <table className="survey-table" style={{ width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0' }}>
                  <th style={{ width: '45px' }}>#</th>
                  <th>File Name</th>
                  <th>Directory Path</th>
                  <th>Size</th>
                  <th>Type</th>
                  <th>Uploaded Date</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Subfolder Rows in Table (Click to open folder) */}
                {subfolders.map((folderPath) => {
                  const displayName = folderPath.replace(currentFolder, '').replace(/\/$/, '');
                  return (
                    <tr
                      key={folderPath}
                      onClick={() => setCurrentFolder(folderPath)}
                      style={{ background: '#F8FAFC', cursor: 'pointer', borderBottom: '1px solid #E2E8F0', transition: 'background 0.15s ease' }}
                      className="folder-table-row"
                      title={`Click to open folder: ${displayName}`}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <Folder size={17} color="#0D9488" />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="doc-type-icon" style={{ background: '#CCFBF1', color: '#0D9488', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center' }}>
                            <Folder size={18} />
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{displayName}</span>
                              <span style={{ fontSize: '11px', background: '#CCFBF1', color: '#0D9488', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>Folder</span>
                            </div>
                            <span style={{ fontSize: '11.5px', color: '#0D9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <FolderOpen size={13} /> Click to open this folder
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="doc-folder-pill">
                          <Folder size={12} />
                          {folderPath}
                        </span>
                      </td>
                      <td style={{ color: '#64748B', fontSize: '13px' }}>—</td>
                      <td>
                        <span className="doc-ext-badge" style={{ background: '#CCFBF1', color: '#0D9488' }}>FOLDER</span>
                      </td>
                      <td style={{ color: '#64748B', fontSize: '13px' }}>—</td>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="btn-doc-action"
                            onClick={() => setCurrentFolder(folderPath)}
                            title={`Open folder: ${displayName}`}
                          >
                            <FolderOpen size={15} color="#0D9488" />
                          </button>
                          <button
                            className="btn-doc-action"
                            onClick={() => handleDownloadFolder(folderPath)}
                            title={`Download all files in "${displayName}"`}
                          >
                            <Download size={15} />
                          </button>
                          <button
                            className="btn-doc-action delete"
                            onClick={() => handleDeleteFolder(folderPath)}
                            title={`Delete folder "${displayName}"`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* 2. Files List */}
                {files.map((file, idx) => (
                  <tr key={file.id || file.file_key} style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
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

                        {/* Download File */}
                        <a
                          href={`${API_BASE_URL}/api/docs/file/${encodeURIComponent(file.file_key)}`}
                          download={file.file_name}
                          className="btn-doc-action"
                          title="Download file"
                        >
                          <Download size={15} />
                        </a>

                        {/* Delete File */}
                        <button
                          className="btn-doc-action delete"
                          onClick={() => handleDeleteFile(file)}
                          title="Delete from Cloudflare R2"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. New Folder Modal Dialog */}
      {isNewFolderModalOpen && createPortal(
        <div
          className="wizard-backdrop animate-fade-in"
          onClick={() => setIsNewFolderModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto'
          }}
        >
          <div
            className="modal-card animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '440px',
              width: '100%',
              margin: 'auto',
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
              position: 'relative',
              zIndex: 1000000
            }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#CCFBF1', color: '#0D9488', padding: '8px', borderRadius: '10px' }}>
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Create New Folder</h3>
                  <p className="modal-subtitle">Directory: {currentFolder}</p>
                </div>
              </div>
              <button className="wizard-close-btn" onClick={() => setIsNewFolderModalOpen(false)}>
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
                  placeholder="e.g. Case Documents, Affidavits, Invoices"
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
        </div>,
        document.body
      )}
    </div>
  );
}
