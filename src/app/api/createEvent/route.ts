import { NextRequest, NextResponse } from 'next/server';
import { auth, db, storage } from '../../lib/firebaseAdmin';
import admin from 'firebase-admin';

// Configure route to handle large files
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

/* API for creating new events with Google Drive links */
export async function POST(req: NextRequest) {
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

        // Check if user is admin using the isAdmin API endpoint logic
        // This uses the same logic as /api/isAdmin to ensure consistency
        const isUserAdmin = decodedToken.isAdmin === true;

        if (!isUserAdmin) {
            console.log('Admin access denied for user:', decodedToken.uid);
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { name, driveUrl, thumbnailData, thumbnailFileName, eventDate } = body;

        if (!name || !driveUrl || !thumbnailData || !thumbnailFileName || !eventDate) {
            return NextResponse.json({ 
                error: 'Missing required fields: name, driveUrl, thumbnailData, thumbnailFileName, and eventDate are required' 
            }, { status: 400 });
        }

        // Convert base64 thumbnail data to buffer and upload to Firebase Storage
        const base64Data = thumbnailData.split(',')[1]; // Remove data URL prefix
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Generate unique filename
        const fileName = `${Date.now()}_${thumbnailFileName.split('.')[0]}.webp`;
        
        // Use the specific bucket name
        const bucketName = 'mottagningen-7063b.appspot.com';
        const file = storage.bucket(bucketName).file(`event-thumbnails/${fileName}`);
        
        // Upload the image
        await file.save(imageBuffer, {
            metadata: {
                contentType: 'image/webp',
            },
        });
        
        // Make the file publicly accessible
        await file.makePublic();
        
        // Get the public URL
        const thumbnailUrl = `https://storage.googleapis.com/${bucketName}/event-thumbnails/${fileName}`;

        // Get user document from Firestore users collection to fetch username
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();
        
        // Try to get username from various possible fields in the users collection
        let username = 'Unknown User';
        if (userData) {
            username = userData.displayName || userData.username || userData.name || 'Unknown User';
        }

        // Create new event document
        const eventData = {
            name: name.trim(),
            driveUrl: driveUrl.trim(),
            thumbnailUrl: thumbnailUrl,
            eventDate: admin.firestore.Timestamp.fromDate(new Date(eventDate)),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            uploadedBy: {
                uid: decodedToken.uid,
                username: username
            }
        };

        const docRef = await db.collection('events').add(eventData);

        return NextResponse.json({ 
            success: true, 
            message: 'Event created successfully',
            eventId: docRef.id 
        });
    } catch (error) {
        console.error('Error creating event:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
