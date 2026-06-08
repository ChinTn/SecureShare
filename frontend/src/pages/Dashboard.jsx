import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import {
  encryptFile,
  encryptAESKeyWithPublicKey,
  calculateIntegrityHash,
  decryptFile,
} from "../utils/crypto";
import { Link } from "react-router-dom";
import ShareModal from "../components/ShareModal";

// Setup axios defaults if not already done globally
axios.defaults.withCredentials = true;

const Dashboard = () => {
  const { user, privateKey, logout } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef(null);

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState(null);

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
      alert(
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
      alert("Failed to upload and encrypt file.");
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
        alert(
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
      alert("Failed to download or decrypt file.");
      setStatusMessage("");
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this encrypted file?",
      )
    )
      return;
    try {
      await axios.delete(`http://localhost:5000/api/files/${id}`);
      setFiles(files.filter((f) => f._id !== id));
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete file.");
    }
  };

  const openShareModal = (file) => {
    setFileToShare(file);
    setIsShareModalOpen(true);
  };

  return (
    <div
      className="min-h-screen text-white p-8 font-sans"
      style={{
        background:
          "radial-gradient(circle at 50% -20%, #312e81 0%, #0f172a 50%)",
        backgroundColor: "#0f172a",
      }}
    >
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

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Navigation & Header */}
        <div className="flex justify-between items-center bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Zero-Knowledge Vault
            </h1>
            <nav className="flex gap-4">
              <span className="text-white font-bold border-b-2 border-violet-500 pb-1">
                My Vault
              </span>
              <Link
                to="/shared"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Shared Hub
              </Link>
              <Link
                to="/audit"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Security Logs
              </Link>
              <Link
                to="/settings"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-gray-300 text-sm">
              Logged in as:{" "}
              <span className="font-mono text-violet-300">{user?.email}</span>
            </p>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 hover:bg-red-500 hover:text-white rounded-lg transition-all text-sm font-semibold"
            >
              Lock Vault
            </button>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-10 rounded-2xl shadow-2xl text-center relative overflow-hidden group hover:border-violet-500/50 transition-colors">
          <input
            type="file"
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-violet-500/30 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-8 h-8 text-violet-300"
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
            <h3 className="text-xl font-bold">Drag & Drop to Encrypt</h3>
            <p className="text-gray-300 text-sm">
              Files are instantly encrypted in your browser's RAM before leaving
              your computer. Max size: 100MB.
            </p>
          </div>

          {/* Progress Indicator */}
          {uploadProgress > 0 && (
            <div className="mt-8 space-y-2 relative z-20">
              <div className="flex justify-between text-xs font-mono text-violet-300">
                <span>{statusMessage}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* File List */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative z-20">
          <div className="p-6 border-b border-white/20 flex justify-between items-center">
            <h2 className="text-xl font-bold">My Encrypted Files</h2>
            {statusMessage && !uploadProgress && (
              <span className="text-xs font-mono text-violet-300 animate-pulse">
                {statusMessage}
              </span>
            )}
          </div>

          {loading && files.length === 0 ? (
            <div className="p-10 text-center text-gray-300 animate-pulse">
              Loading vault...
            </div>
          ) : files.length === 0 ? (
            <div className="p-10 text-center text-gray-300">
              Your vault is empty.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {files.map((file) => (
                <div
                  key={file._id}
                  className="p-6 flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-500/30 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-indigo-300"
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
                    <div>
                      <h4 className="font-semibold">{file.originalName}</h4>
                      <p className="text-xs text-gray-300">
                        {(file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                        {new Date(file.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => openShareModal(file)}
                      className="px-3 py-2 bg-blue-600/50 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-all border border-blue-500/50"
                    >
                      Share
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-violet-500/30"
                    >
                      Decrypt & Download
                    </button>
                    <button
                      onClick={() => handleDelete(file._id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all cursor-pointer relative z-30"
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
