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

    // Parse multipart/form-data
    const formData = await req.formData();
    // Accept multiple images[]
    const images: File[] = [];
    const pdfNameRaw = formData.get('pdfName');
    const displayNameRaw = formData.get('displayName');
    let pdfName = typeof pdfNameRaw === 'string' ? pdfNameRaw : 'unknown_pdf';
    let displayName = typeof displayNameRaw === 'string' ? displayNameRaw : '';
    
    for (const entry of Array.from(formData.entries())) {
      const [key, value] = entry;
      if (key === 'images[]' && value instanceof File) {
        images.push(value);
      }
    }
    if (images.length === 0) {
      return NextResponse.json({ error: 'No images uploaded' }, { status: 400 });
    }

    // Sanitize pdfName for folder name
    pdfName = pdfName.replace(/\s+/g, '_').replace(/å|ä/gi, 'a').replace(/ö/gi, 'o').replace(/[^a-zA-Z0-9_.-]/g, '');

    // Check if subfolder already exists
    const bucket = storage.bucket('mottagningen-7063b.appspot.com');
    const [existingFiles] = await bucket.getFiles({ prefix: `blandare/${pdfName}/` });
    if (existingFiles.length > 0) {
      return NextResponse.json({ error: 'Bländare already exists' }, { status: 409 });
    }

    // Upload each image to Firebase Storage
    const uploaded: string[] = [];
    for (const img of images) {
      // Sanitize filename
      let imgName = img.name.replace(/\s+/g, '_');
      imgName = imgName.replace(/å|ä/gi, 'a').replace(/ö/gi, 'o');
      imgName = imgName.replace(/[^a-zA-Z0-9_.-]/g, '');
      const dest = `blandare/${pdfName}/${imgName}`;
      const arrayBuffer = await img.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileRef = bucket.file(dest);
      await fileRef.save(buffer, {
        metadata: {
          contentType: img.type || 'image/png',
          cacheControl: `public, max-age=${CACHE_MAX_AGE}`,
        },
        resumable: false,
      });
      uploaded.push(dest);
    }

    // Store display name metadata if provided
    if (displayName) {
      const metadataFile = bucket.file(`blandare/${pdfName}/metadata.json`);
      const metadata = {
        displayName,
        pdfName,
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

    return NextResponse.json({ success: true, uploaded }, {
      headers: { 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
