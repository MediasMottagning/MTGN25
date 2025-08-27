import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export default function AdminUploadPDF() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      let token: string | null = null;
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
      const res = await fetch('/api/createBlandare', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      setSuccess('PDF converted and images uploaded successfully!');
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-xl bg-white rounded-lg shadow-md p-6 space-y-6">
    <div className="space-y-3 max-h-[30rem] overflow-y-auto">
      <form onSubmit={handleSubmit}>
                  <h1 className="mb-3 text-2xl font-semibold text-center">Upload Bländare</h1>
        <label className="block text-gray-700 font-semibold text-sm mb-2">Upload PDF</label>
        <input
          type="file"
          accept="application/pdf"
          className="border border-gray-300 rounded-lg p-2 w-full text-sm"
          ref={fileInputRef}
          required
        />
        <button
          type="submit"
          className="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition duration-200 text-sm"
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        {success && <p className="text-green-600 mt-2">{success}</p>}
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </form>
    </div>
    </div>
  );
};

