"use client"
import React, { useState, ChangeEvent } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../../lib/firebaseConfig';
import ImageCropper from './ImageCropper';

export default function ProfilePictureUploader() {
  const [profilePicUid, setProfilePicUid] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCrop = async (croppedBlob: Blob) => {
    setShowCropper(false);
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!profilePicUid.trim()) {
        throw new Error('Please enter a user UID');
      }

      // Upload to Firebase Storage
      const storageRef = ref(storage, `profilePictures/${profilePicUid}.png`);
      await uploadBytes(storageRef, croppedBlob);

      // Update Firestore document
      const userDocRef = doc(db, 'users', profilePicUid);
      await updateDoc(userDocRef, {
        profilePicture: `profilePictures/${profilePicUid}.png`
      });

      setSuccess('Profile picture updated successfully!');
      setProfilePicUid('');
      setImagePreview(null);
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      setError(error.message || 'Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImagePreview(null);
  };

  return (
    <div className="w-full max-w-xl bg-white rounded-lg shadow-md p-6 space-y-6">
      <h1 className="mb-3 text-2xl font-semibold text-center">Update Profile Picture</h1>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-gray-700 font-semibold text-sm">User UID</label>
          <input
            type="text"
            value={profilePicUid}
            onChange={(e) => setProfilePicUid(e.target.value)}
            placeholder="Enter user UID"
            className="border border-gray-300 rounded-lg p-2 w-full text-sm"
            required
          />
          <p className="text-xs text-gray-500">
            Enter the UID of the user whose profile picture you want to update
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-semibold text-sm">Upload Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="border border-gray-300 rounded-lg p-2 w-full text-sm"
            disabled={uploading}
          />
          <p className="text-xs text-gray-500">
            Select an image file to crop and upload as profile picture
          </p>
        </div>

        {uploading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-sm text-gray-600">Uploading...</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>

      {showCropper && imagePreview && (
        <ImageCropper
          imageUrl={imagePreview}
          onCrop={handleCrop}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
