import { GoogleGenerativeAI } from '@google/generative-ai';

export const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing GOOGLE_GENERATIVE_AI_KEY in environment variables. ' +
      'Please add your Gemini API key to .env.local'
    );
  }

  return new GoogleGenerativeAI(apiKey);
};

export async function generateBoxScoreStory(
  boxScoreContent: string,
  standings?: string,
  schedule?: string,
  coachNames?: { [coachName: string]: string }
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  let additionalContext = '';

  if (standings) {
    additionalContext += `\n\nCurrent Standings:\n${standings}`;
  }

  if (schedule) {
    additionalContext += `\n\nUpcoming Schedule:\n${schedule}`;
  }

  let coachHumor = '';
  if (coachNames && Object.keys(coachNames).length > 0) {
    coachHumor = `\n\nCoach Information (make light-hearted references to these coaches and their teams):`;
    for (const [coachName, teamName] of Object.entries(coachNames)) {
      coachHumor += `\n- ${coachName} coaches ${teamName}`;
    }
  }

  const prompt = `You are an expert sports writer covering professional football. Write an engaging, detailed sports column about the game that is witty, entertaining, and somewhat humorous (especially when mentioning coaches by name).

Include:
- Key plays and turning points
- Outstanding individual performances
- Strategic observations
- Game impact and implications
- Light-hearted humor about the coaches (use their actual names)
- Context from standings and what this game means for playoff positioning
- Engaging narrative and storytelling

Box Score:
${boxScoreContent}${additionalContext}${coachHumor}

Write a compelling 4-5 paragraph sports column that's entertaining and funny!`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('No content generated from Gemini');
    }

    return text;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Gemini generation error:', errorMsg);
    throw error;
  }
}

export function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
