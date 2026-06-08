import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  encryptFile,
  encryptAESKeyWithPublicKey,
  calculateIntegrityHash,
  decryptFile,
} from "../utils/crypto";
import { Link } from "react-router-dom";
import ShareModal from "../components/ShareModal";
import ConfirmModal from "../components/ConfirmModal";
import { toast } from "../utils/toast";

// Setup axios defaults if not already done globally
axios.defaults.withCredentials = true;

const Dashboard = () => {
  const { user, privateKey, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef(null);

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState(null);

  // Confirm Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:5000/api/files");
      setFiles(res.data.files || []);
    } catch (error) {
      console.error("Failed to fetch files", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error(
        "File is too large! The browser memory limit for Zero-Knowledge encryption is 100MB.",
      );
      return;
    }

    try {
      setUploadProgress(10);
      setStatusMessage("Reading file into memory...");

      const arrayBuffer = await file.arrayBuffer();

      setUploadProgress(30);
      setStatusMessage("Encrypting file with AES-GCM...");

      const { encryptedData, rawAesKey, iv, authTag } =
        await encryptFile(arrayBuffer);

      const integrityHash = await calculateIntegrityHash(arrayBuffer);

      setUploadProgress(60);
      setStatusMessage("Locking AES Key with your RSA Public Key...");

      const encryptedAESKey = await encryptAESKeyWithPublicKey(
        rawAesKey,
        user.publicKey,
      );

      setUploadProgress(80);
      setStatusMessage("Uploading encrypted vault to server...");

      const payload = {
        encryptedData,
        encryptedAESKey,
        iv,
        authTag,
        integrityHash,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      };

      await axios.post("http://localhost:5000/api/files/upload", payload);

      setUploadProgress(100);
      setStatusMessage("Upload complete!");

      await fetchFiles();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload and encrypt file.");
    } finally {
      setTimeout(() => {
        setUploadProgress(0);
        setStatusMessage("");
      }, 3000);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (file) => {
    try {
      setStatusMessage(
        `Downloading encrypted blob for ${file.originalName}...`,
      );

      const res = await axios.get(
        `http://localhost:5000/api/files/download/${file._id}`,
      );
      const {
        encryptedData,
        encryptedAESKey,
        iv,
        authTag,
        integrityHash,
        mimeType,
      } = res.data;

      setStatusMessage(`Decrypting ${file.originalName} in RAM...`);

      const decryptedBuffer = await decryptFile(
        encryptedData,
        encryptedAESKey,
        iv,
        authTag,
        privateKey,
      );

      const newHash = await calculateIntegrityHash(decryptedBuffer);
      if (newHash !== integrityHash) {
        //Integrity issue logged in AuditLog
        await axios.post('http://localhost:5000/api/audit/integrity', { 
                    fileId: share ? share.file._id : file._id,
                    details: `Tampered file detected: ${share ? share.file.originalName : file.originalName}`
                });
        toast.error(
          "WARNING: File integrity check failed! The file may have been corrupted or tampered with. Check console for hashes.",
        );
        return;
      }

      setStatusMessage("Decryption successful! Saving file...");


      //Browser downloads the file
      const blob = new Blob([decryptedBuffer], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      setStatusMessage("");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download or decrypt file.");
      setStatusMessage("");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    try {
      await axios.delete(`http://localhost:5000/api/files/${id}`);
      setFiles(files.filter((f) => f._id !== id));
      toast.success("File securely deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openShareModal = (file) => {
    setFileToShare(file);
    setIsShareModalOpen(true);
  };

  return (
    <div className="p-8 pb-20 animate-fade-in">
      {/* Render Share Modal if Open */}
      {isShareModalOpen && fileToShare && (
        <ShareModal
          file={fileToShare}
          onClose={() => {
            setIsShareModalOpen(false);
            setFileToShare(null);
          }}
        />
      )}

      {/* Render Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Encrypted File?"
        message="Are you sure you want to permanently delete this file? This action cannot be undone."
        confirmText="Yes, Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Navigation & Header */}
        <div className="flex justify-between items-center bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 p-6 rounded-2xl shadow-sm transition-colors">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">
              Secure<span className="text-orange-500">Share</span>
            </h1>
            <nav className="flex gap-4 text-sm font-semibold tracking-wide uppercase">
              <span className="text-gray-900 dark:text-white border-b-2 border-orange-500 pb-1">
                My Vault
              </span>
              <Link
                to="/shared"
                className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors"
              >
                Shared Hub
              </Link>
              <Link
                to="/audit"
                className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors"
              >
                Security Logs
              </Link>
              <Link
                to="/settings"
                className="text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            {/* Theme Toggle Button */}
            <button onClick={toggleTheme} className="p-2 text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">
                {theme === 'dark' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                )}
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">
                Logged in as
              </p>
              <p className="font-mono text-sm text-gray-900 dark:text-white">
                {user?.email}
              </p>
            </div>
            <button
              onClick={logout}
              className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-red-50 text-red-600 dark:text-red-400 hover:text-red-700 font-bold rounded-lg transition-all text-sm uppercase tracking-wider"
            >
              Lock Vault
            </button>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="bg-gray-50 dark:bg-[#252525] border-2 border-dashed border-gray-300 dark:border-white/20 p-16 rounded-2xl text-center relative overflow-hidden group hover:border-orange-500 transition-colors">
          <input
            type="file"
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
          />
          <div className="space-y-6 relative z-20">
            <div className="w-20 h-20 mx-auto bg-orange-100 dark:bg-orange-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg
                className="w-10 h-10 text-orange-600 dark:text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                ></path>
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Drag & Drop to Encrypt</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                Files are instantly encrypted in your browser's RAM. Max size: 100MB.
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          {uploadProgress > 0 && (
            <div className="mt-8 space-y-3 relative z-20 max-w-lg mx-auto bg-white dark:bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
              <div className="flex justify-between text-xs font-mono font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                <span className="text-orange-600 dark:text-orange-400">{statusMessage}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* File List */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden transition-colors">
          <div className="p-8 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-transparent">
            <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">My Encrypted Vault</h2>
            {statusMessage && !uploadProgress && (
              <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 animate-pulse tracking-wider uppercase">
                {statusMessage}
              </span>
            )}
          </div>

          {loading && files.length === 0 ? (
            <div className="p-16 text-center text-gray-400 font-medium animate-pulse">
              Loading vault...
            </div>
          ) : files.length === 0 ? (
            <div className="p-16 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Your vault is entirely empty.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-white/10">
              {files.map((file) => (
                <div
                  key={file._id}
                  className="p-6 flex flex-col sm:flex-row items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors gap-6 sm:gap-0"
                >
                  <div className="flex items-center gap-5 w-full sm:w-auto">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-gray-200 dark:border-white/10">
                      <svg
                        className="w-6 h-6 text-gray-600 dark:text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        ></path>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">{file.originalName}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {new Date(file.uploadDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto shrink-0 justify-end">
                    <button
                      onClick={() => openShareModal(file)}
                      className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white text-sm font-bold tracking-wide uppercase rounded-lg transition-colors border border-gray-200 dark:border-white/10"
                    >
                      Share
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold tracking-wide uppercase rounded-lg transition-colors shadow-sm"
                    >
                      Decrypt & Download
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(file._id)}
                      className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
