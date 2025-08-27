import { NextRequest, NextResponse } from 'next/server';
import { auth, storage } from '../../lib/firebaseAdmin';

// Configure route to handle large files
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout (Vercel limit)
export const dynamic = 'force-dynamic';

const CACHE_MAX_AGE = 60 * 60 * 24 * 30; // 1 month in seconds

export async function POST(req: NextRequest) {
  // Authenticate user
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

        // Parse JSON request body (images are already uploaded to Firebase Storage)
        const { pdfName, displayName, uploadedPaths, pageCount } = await req.json();
        
        if (!pdfName || !uploadedPaths || uploadedPaths.length === 0) {
            return NextResponse.json({ error: 'Missing required fields: pdfName and uploadedPaths' }, { status: 400 });
        }

        // Check if subfolder already exists
        const bucket = storage.bucket('mottagningen-7063b.appspot.com');
        const [existingFiles] = await bucket.getFiles({ prefix: `blandare/${pdfName}/` });
        if (existingFiles.length > 0) {
            return NextResponse.json({ error: 'Bländare already exists' }, { status: 409 });
        }

        // Images are already uploaded to Firebase Storage by the client
        // Just store the metadata if displayName is provided
        if (displayName) {
            const metadataFile = bucket.file(`blandare/${pdfName}/metadata.json`);
            const metadata = {
                displayName,
                pdfName,
                pageCount,
                uploadedPaths,
                createdAt: new Date().toISOString(),
                uploadedBy: decodedToken.uid
            };
            await metadataFile.save(JSON.stringify(metadata), {
                metadata: {
                    contentType: 'application/json',
                },
                resumable: false,
            });
        }

        return NextResponse.json({ 
            success: true, 
            uploaded: uploadedPaths,
            pdfName,
            pageCount 
        }, {
            headers: { 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` }
        });
    } catch (error) {
        console.error('Error creating bländare:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
