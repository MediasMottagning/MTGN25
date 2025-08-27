"use client"
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '../useAuth';

interface Event {
  id: string;
  name: string;
  driveUrl: string;
  thumbnailUrl: string;
  eventDate?: string;
  createdAt: string;
  uploadedBy?: {
    username: string;
  };
}

interface EventsListProps {
  events: Event[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (event: Event) => void;
  onDelete: (eventId: string, eventName: string) => void;
  onUpdate: (eventId: string, data: any) => void;
}

export default function EventsList({ 
  events, 
  loading, 
  onRefresh, 
  onEdit, 
  onDelete,
  onUpdate
}: EventsListProps) {
  const { user } = useAuth();
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventName, setEditEventName] = useState('');
  const [editEventDriveUrl, setEditEventDriveUrl] = useState('');
  const [editEventThumbnail, setEditEventThumbnail] = useState<File | null>(null);
  const [editEventDate, setEditEventDate] = useState('');
  const [editEventHour, setEditEventHour] = useState('');
  const [editEventMinute, setEditEventMinute] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [updating, setUpdating] = useState(false);

  const convertToWebP = (file: File, quality: number = 0.8, maxWidth: number = 800, maxHeight: number = 600): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = Math.min(width, maxWidth);
            height = width / aspectRatio;
          } else {
            height = Math.min(height, maxHeight);
            width = height * aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
                reject(new Error(`Failed to convert image to WebP. Input file type: ${file.type}, requested output format: image/webp. This may be due to browser limitations or unsupported image format.`));
            }
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatEventDate = (dateString?: string) => {
    if (!dateString) return 'No date set';
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleStartEdit = (event: Event) => {
    setEditingEventId(event.id);
    setEditEventName(event.name);
    setEditEventDriveUrl(event.driveUrl);
    
    if (event.eventDate) {
      const eventDate = new Date(event.eventDate);
      setEditEventDate(eventDate.toISOString().split('T')[0]);
      setEditEventHour(eventDate.getHours().toString().padStart(2, '0'));
      setEditEventMinute(eventDate.getMinutes().toString().padStart(2, '0'));
    }
    
    setEditEventThumbnail(null);
    setUpdateError('');
  };

  const handleCancelEdit = () => {
    setEditingEventId(null);
    setEditEventName('');
    setEditEventDriveUrl('');
    setEditEventThumbnail(null);
    setEditEventDate('');
    setEditEventHour('');
    setEditEventMinute('');
    setUpdateError('');
  };

  const handleUpdateEvent = async (e: FormEvent) => {
    e.preventDefault();
    setUpdateError('');
    setUpdating(true);

    try {
      const updateData: any = {
        eventId: editingEventId!,
        name: editEventName,
        driveUrl: editEventDriveUrl,
      };
      
      if (editEventDate && editEventHour && editEventMinute) {
        const eventDateTime = new Date(`${editEventDate}T${editEventHour}:${editEventMinute}`);
        updateData.eventDate = eventDateTime.toISOString();
      }
      
      if (editEventThumbnail) {
        try {
          // Convert image to WebP
          const webpBlob = await convertToWebP(editEventThumbnail);
          
          // Convert to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                // Keep the full data URL (like CreateEventForm does)
                resolve(reader.result);
              } else {
                reject(new Error('Failed to convert to base64'));
              }
            };
            reader.onerror = () => reject(new Error('FileReader error'));
          });
          
          reader.readAsDataURL(webpBlob);
          const base64Data = await base64Promise;
          
          updateData.thumbnailData = base64Data;
          updateData.thumbnailFileName = `${editEventName.replace(/\s+/g, '_')}_thumbnail.webp`;
        } catch (conversionError) {
          console.error('Error converting image:', conversionError);
          setUpdateError('Failed to process image. Please try again.');
          return;
        }
      }

      if (!user) {
        setUpdateError('Authentication required');
        return;
      }
      
      const token = await user.getIdToken();
      const response = await fetch('/api/updateEvent', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        handleCancelEdit();
        onRefresh();
      } else {
        const errorData = await response.json();
        setUpdateError(errorData.error || 'Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      setUpdateError('Failed to update event');
    } finally {
      setUpdating(false);
    }
  };

  const handleThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEditEventThumbnail(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Manage Events</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition duration-200 disabled:bg-gray-400"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-4 max-h-[32rem] overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No events found</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="border border-gray-200 rounded-lg p-4">
              {editingEventId === event.id ? (
                // Edit mode
                <form onSubmit={handleUpdateEvent} className="space-y-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Edit Event</h3>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-700 font-semibold text-sm">Event Name</label>
                      <input
                        type="text"
                        value={editEventName}
                        onChange={(e) => setEditEventName(e.target.value)}
                        className="border border-gray-300 rounded-lg p-2 w-full text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-700 font-semibold text-sm">Google Drive Link</label>
                      <input
                        type="url"
                        value={editEventDriveUrl}
                        onChange={(e) => setEditEventDriveUrl(e.target.value)}
                        className="border border-gray-300 rounded-lg p-2 w-full text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-700 font-semibold text-sm">Event Date</label>
                      <input
                        type="date"
                        value={editEventDate}
                        onChange={(e) => setEditEventDate(e.target.value)}
                        className="border border-gray-300 rounded-lg p-2 w-full text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-700 font-semibold text-sm">Event Time</label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editEventHour}
                          onChange={(e) => setEditEventHour(e.target.value)}
                          className="border border-gray-300 rounded-lg p-2 w-full text-sm"
                          required
                        >
                          <option value="">Hour</option>
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i.toString().padStart(2, '0')}>
                              {i.toString().padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editEventMinute}
                          onChange={(e) => setEditEventMinute(e.target.value)}
                          className="border border-gray-300 rounded-lg p-2 w-full text-sm"
                          required
                        >
                          <option value="">Minute</option>
                          {['00', '15', '30', '45'].map((minute) => (
                            <option key={minute} value={minute}>
                              {minute}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-gray-700 font-semibold text-sm">Thumbnail Image</label>
                      <input
                        type="file"
                        onChange={handleThumbnailChange}
                        accept="image/*"
                        className="border border-gray-300 rounded-lg p-2 w-full text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to keep current thumbnail
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="submit"
                      disabled={updating}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition duration-200 text-sm disabled:bg-gray-400"
                    >
                      {updating ? 'Updating...' : 'Update Event'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition duration-200 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  {updateError && <p className="text-red-500 text-sm">{updateError}</p>}
                </form>
              ) : (
                // Display mode
                <div className="flex items-center space-x-3">
                  <img
                    src={event.thumbnailUrl}
                    alt={event.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{event.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatEventDate(event.eventDate || event.createdAt)}
                    </p>
                    <p className="text-xs text-gray-400">
                      Created by: {event.uploadedBy?.username || 'Unknown'}
                    </p>
                    <a
                      href={event.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View Drive Folder →
                    </a>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => handleStartEdit(event)}
                      className="bg-blue-500 text-white text-sm px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(event.id, event.name)}
                      className="bg-red-500 text-white text-sm px-4 py-2 rounded hover:bg-red-600 transition duration-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
