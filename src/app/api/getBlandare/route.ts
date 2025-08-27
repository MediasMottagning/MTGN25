import { NextRequest, NextResponse } from 'next/server';
import { auth, storage } from '../../lib/firebaseAdmin';

export async function GET(req: NextRequest) {
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

        // Fetch all files from the 'blandare' folder in Firebase Storage
        const bucket = storage.bucket("mottagningen-7063b.appspot.com");
        const [files] = await bucket.getFiles({ prefix: 'blandare/' });

        // Extract unique subfolder names with their creation times
        const folderMap = new Map();
        files.forEach(file => {
            const match = file.name.match(/^blandare\/([^/]+)\//);
            if (match && file.metadata.timeCreated) {
                const folderName = match[1];
                const creationTime = file.metadata.timeCreated;
                if (!folderMap.has(folderName) || creationTime < folderMap.get(folderName)) {
                    folderMap.set(folderName, creationTime);
                }
            }
        });

        // Sort folders by creation time (oldest first)
        const subfolders = Array.from(folderMap.entries())
            .sort((a, b) => new Date(a[1]).getTime() - new Date(b[1]).getTime())
            .map(entry => entry[0]);

        // For each subfolder, get all images and their signed URLs
        const blandareDetails: any[] = [];
        for (const folder of subfolders) {
            const [imageFiles] = await bucket.getFiles({ prefix: `blandare/${folder}/` });
            
            // Try to read metadata file for display name
            let displayName = folder; // Default to folder name
            try {
                const metadataFile = bucket.file(`blandare/${folder}/metadata.json`);
                const [exists] = await metadataFile.exists();
                if (exists) {
                    const [metadataContent] = await metadataFile.download();
                    const metadata = JSON.parse(metadataContent.toString());
                    displayName = metadata.displayName || folder;
                }
            } catch (error) {
                console.log('No metadata found for folder:', folder);
                // Use folder name as fallback
            }
            
            const imageUrls = await Promise.all(
                imageFiles
                    .filter(f => f.name.match(/\.(png|jpg|jpeg|webp)$/i))
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                    .map(async (imgFile) => {
                        const [url] = await imgFile.getSignedUrl({
                            action: 'read',
                            expires: Date.now() + 60 * 60 * 24, // 1 day
                        });
                        return url;
                    })
            );
            if (imageUrls.length > 0) {
                blandareDetails.push({
                    name: folder,
                    displayName: displayName,
                    images: imageUrls,
                    timeCreated: folderMap.get(folder)
                });
            }
        }

        // For backward compatibility, also return the old format
        const allImages = blandareDetails.map(item => item.images);

        return NextResponse.json({ 
            blandare: blandareDetails,  // New detailed format
            allImages: allImages        // Old format for compatibility
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}