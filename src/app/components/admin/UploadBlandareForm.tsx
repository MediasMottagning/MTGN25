"use client"
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../useAuth';

interface UploadBlandareFormProps {
  onBlandareUploaded?: () => void;
}

export default function UploadBlandareForm({ onBlandareUploaded }: UploadBlandareFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;
    if (typeof window !== "undefined") {
      import('react-pdf').then(({ pdfjs }) => {
        if (isMounted && pdfjs && pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        }
      });
    }
    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Please select a PDF file.');
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }

    const pdfNameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
    setUploading(true);

    try {
      let token = null;
      if (user) {
        token = await user.getIdToken();
      }

      // Convert PDF to images
      const arrayBuffer = await file.arrayBuffer();
      const { pdfjs } = await import('react-pdf');
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const images: Blob[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (!context) {
          throw new Error('Could not get canvas 2D context');
        }
        await page.render({ canvasContext: context, viewport }).promise;
        
        // Convert canvas to blob
        const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        images.push(blob);
      }

      const formData = new FormData();
      images.forEach((img, idx) => {
        formData.append('images[]', img, `page-${idx + 1}.png`);
      });
      formData.append('pdfName', pdfNameWithoutExtension);
      formData.append('displayName', customName);
      
      const res = await fetch('/api/createBlandare', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      
      if (!res.ok) {
        let errorMessage = 'Upload failed';
        try {
          const data = await res.json();
          errorMessage = data.error || 'Upload failed';
        } catch (jsonError) {
          // If JSON parsing fails, try to get text response
          try {
            const textResponse = await res.text();
            errorMessage = textResponse || `HTTP ${res.status}: ${res.statusText}`;
          } catch (textError) {
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }
      
      setSuccess('PDF converted and images uploaded successfully!');
      
      // Trigger refresh in parent component
      if (onBlandareUploaded) {
        onBlandareUploaded();
      }
      
      // Clear form
      setCustomName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-xl bg-white rounded-lg shadow-md p-6 space-y-6">
      <form onSubmit={handleSubmit}>
        <h1 className="mb-3 text-2xl font-semibold text-center">Upload New Bländare</h1>
        
        <div className="space-y-2">
          <label className="block text-gray-700 font-semibold text-sm">Bländare Name</label>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="ex. Bländaren 1, Bländaren 2, Slutaren etc"
            className="border border-gray-300 rounded-lg p-2 w-full text-sm"
            required
          />
          <p className="text-xs text-gray-500">
            This name will appear on the buttons in the bländare page
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-semibold text-sm">Upload PDF</label>
          <input
            type="file"
            accept="application/pdf"
            className="border border-gray-300 rounded-lg p-2 w-full text-sm"
            ref={fileInputRef}
            required
          />
          <p className="text-xs text-gray-500">
            PDF will be converted to images and uploaded automatically
          </p>
        </div>
        <button
          type="submit"
          className="mt-3 w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition duration-200 text-sm"
          disabled={uploading}
        >
          {uploading ? 'Converting and Uploading...' : 'Upload Bländare'}
        </button>
        {success && <p className="text-green-600 mt-2">{success}</p>}
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </form>
    </div>
  );
}
