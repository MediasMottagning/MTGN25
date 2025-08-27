import { NextRequest, NextResponse } from 'next/server';
import { auth, storage } from '../../lib/firebaseAdmin';

// Configure route to handle large files
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout
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
    const { pdfName: rawPdfName, displayName, uploadedPaths, pageCount } = await req.json();
    
    console.log('Received request:', { rawPdfName, displayName, uploadedPaths: uploadedPaths?.length, pageCount });
    
    if (!rawPdfName) {
        return NextResponse.json({ error: 'Missing required field: pdfName' }, { status: 400 });
    }

    // Sanitize pdfName for folder name
    const pdfName = rawPdfName.replace(/\s+/g, '_').replace(/å|ä/gi, 'a').replace(/ö/gi, 'o').replace(/[^a-zA-Z0-9_.-]/g, '');

    console.log(`Processing bländare: ${pdfName}`);
    
    const bucket = storage.bucket('mottagningen-7063b.appspot.com');

    // Validate required fields
    if (!uploadedPaths || uploadedPaths.length === 0) {
        console.log('Validation failed - uploadedPaths:', uploadedPaths);
        return NextResponse.json({ error: 'Missing required fields: uploadedPaths' }, { status: 400 });
    }

    // Images are already uploaded to Firebase Storage by the client
    // Store the metadata if displayName is provided
    if (displayName) {
        try {
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
        } catch (metadataError) {
            console.error('Error saving metadata:', metadataError);
            // Don't fail the entire upload if metadata save fails
            // The images are already uploaded successfully
        }
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
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
