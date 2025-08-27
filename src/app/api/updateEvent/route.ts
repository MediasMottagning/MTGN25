import { NextRequest, NextResponse } from 'next/server';
import { auth, db, storage } from '../../lib/firebaseAdmin';
import admin from 'firebase-admin';

/* API for updating existing events */
export async function PUT(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        if (!decodedToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        const isUserAdmin = decodedToken.isAdmin === true;
        if (!isUserAdmin) {
            console.log('Admin access denied for user:', decodedToken.uid);
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { eventId, name, driveUrl, thumbnailData, thumbnailFileName, eventDate } = body;

        if (!eventId || !name || !driveUrl || !eventDate) {
            return NextResponse.json({ 
                error: 'Missing required fields: eventId, name, driveUrl, and eventDate are required' 
            }, { status: 400 });
        }

        // Check if event exists
        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        
        if (!eventDoc.exists) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Prepare update data
        const updateData: any = {
            name: name.trim(),
            driveUrl: driveUrl.trim(),
            eventDate: admin.firestore.Timestamp.fromDate(new Date(eventDate)),
        };

        // Handle thumbnail update if provided
        if (thumbnailData && thumbnailFileName) {
            // Convert base64 thumbnail data to buffer and upload to Firebase Storage
            const base64Data = thumbnailData.split(',')[1]; // Remove data URL prefix
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // Generate unique filename
            const fileName = `${Date.now()}_${thumbnailFileName.split('.')[0]}.webp`;
            
            // Use the specific bucket name
            const bucketName = 'mottagningen-7063b.appspot.com';
            const file = storage.bucket(bucketName).file(`event-thumbnails/${fileName}`);
            
            // Upload the new image
            await file.save(imageBuffer, {
                metadata: {
                    contentType: 'image/webp',
                },
            });
            
            // Make the file publicly accessible
            await file.makePublic();
            
            // Get the public URL
            const thumbnailUrl = `https://storage.googleapis.com/${bucketName}/event-thumbnails/${fileName}`;
            
            // Add thumbnail URL to update data
            updateData.thumbnailUrl = thumbnailUrl;

            // Optionally delete old thumbnail
            const existingEvent = eventDoc.data();
            if (existingEvent?.thumbnailUrl) {
                try {
                    // Extract filename from URL and delete old file
                    const oldFileName = existingEvent.thumbnailUrl.split('/').pop();
                    if (oldFileName) {
                        const oldFile = storage.bucket(bucketName).file(`event-thumbnails/${oldFileName}`);
                        await oldFile.delete();
                    }
                } catch (error) {
                    // Log but don't fail the update if old file deletion fails
                    console.warn('Failed to delete old thumbnail:', error);
                }
            }
        }

        // Update the event document
        await eventRef.update(updateData);

        return NextResponse.json({ 
            success: true, 
            message: 'Event updated successfully',
            eventId: eventId 
        });
    } catch (error) {
        console.error('Error updating event:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
