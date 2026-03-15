import { NextRequest, NextResponse } from 'next/server';
import { generateBoxScoreStory, extractTextFromHtml } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validTypes = ['text/html', 'text/plain', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload HTML, TXT, or PDF file.' },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const fileText = new TextDecoder().decode(fileBuffer);

    let boxScoreContent = fileText;
    if (file.type === 'text/html') {
      boxScoreContent = extractTextFromHtml(fileText);
    }

    if (!boxScoreContent.trim()) {
      return NextResponse.json(
        { error: 'File content is empty or could not be parsed' },
        { status: 400 }
      );
    }

    const story = await generateBoxScoreStory(boxScoreContent);

    return NextResponse.json({ success: true, story, sourceFile: file.name }, { status: 200 });
  } catch (error) {
    console.error('Press Box API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to generate story', details: errorMessage }, { status: 500 });
  }
}
