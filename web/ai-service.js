/* ai-service.js */

const AI_SERVICE = {
    defaultModel: 'gemini-3-flash-preview',


    // Get Configuration from State (Sheet Source of Truth)
    getConfig: function () {
        const fromState = state.data.settings?.[0];
        let model = fromState?.ai_model || this.defaultModel;
        // Guard: audio/live models can't do text generateContent — fall back to default
        if (model.includes('native-audio') || model.includes('live')) {
            model = this.defaultModel;
        }
        return {
            apiKey: fromState?.ai_api_key || '',
            model: model
        };
    },

    // Save Config (Deprecated - handled by API now)
    saveConfigLocal: function (apiKey, model) {
        // No-op: We now rely on 'saveAllSettings' calling the API explicitly
    },

    // Generate Content
    generateInsight: async function (context, data) {
        const config = this.getConfig();

        if (!config.apiKey) {
            throw new Error("Missing API Key. Please add it in Settings.");
        }

        const prompt = this.constructPrompt(context, data);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || 'AI Request Failed');
            }

            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text || "No insight generated.";

        } catch (error) {
            console.error("AI Service Error:", error);
            throw error;
        }
    },

    // Generate Answer (Chat)
    generateAnswer: async function (question, context, data) {
        const config = this.getConfig();
        if (!config.apiKey) throw new Error("Missing API Key.");

        const contextPrompt = this.constructPrompt(context, data);
        const finalPrompt = `
${contextPrompt}

USER QUESTION: "${question}"

Task: Answer the user's question directly based on the data above. Be concise and helpful.
`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
            });

            if (!response.ok) throw new Error('AI Chat Request Failed');
            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't answer that.";
        } catch (error) {
            throw error;
        }
    },

    // Get personalized book recommendations based on user data
    generateBookRecommendations: async function (userData) {
        const prompt = `
Analyze the user's goals, habits, and interests from the provided data below.
Recommend 5-8 highly relevant books that would specifically help them achieve their goals or improve their life based on their habits and diary reflections.

For each book, provide:
- Title and Author
- Why it's relevant (referencing specific goals/diary/habits)
- Key benefit they'll gain
- Category/Genre

DATA CONTEXT:
Vision Board Goals: ${JSON.stringify((userData.vision_board || userData.vision || []).map(v => ({ title: v.title, category: v.category, description: v.description })))}
Active Habits: ${JSON.stringify((userData.habits || []).slice(0, 15).map(h => ({ name: h.name, category: h.category })))}
Recent Diary Reflections: ${JSON.stringify((userData.diary || []).slice(0, 5).map(d => ({ date: d.date, summary: (d.content || '').slice(0, 200) })))}
Existing Library: ${JSON.stringify((userData.book_library || []).map(b => b.title))}

IMPORTANT: Do NOT recommend books the user already has in their library.

OUTPUT FORMAT: Return a valid JSON array of objects:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reason": "Why it's relevant to your goal X...",
    "benefit": "Key takeaway...",
    "category": "Self-Help/Business/etc"
  }
]
Do not include any other text, only the JSON.
`;
        return await this._callGemini(prompt);
    },

    // ── Gemini API helper (shared by all summary calls) ──
    _callGemini: async function (prompt) {
        const config = this.getConfig();
        if (!config.apiKey) throw new Error("Missing API Key.");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
            })
        });
        if (!response.ok) throw new Error('AI request failed (' + response.status + ')');
        const result = await response.json();
        let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    },

    // ── Book Summary — comprehensive, pure book content, batched ──
    generateBookSummary: async function (bookTitle, author, userGoals, onProgress) {
        /*  STEP 1: Ask AI for the book's table of contents / chapter outline.
         *  This determines how many pages we need (no arbitrary cap). */
        const outlinePrompt = `
You are a world-class book analyst. For the book "${bookTitle}" by ${author}, generate a detailed chapter-by-chapter outline that covers EVERY major idea, framework, story, and concept in the book. Do not skip anything — a reader of this summary should not miss a single important point.

RULES:
- This is PURELY about the book's content. Do NOT reference any external goals, tasks, or user context.
- Include every chapter, every key story/anecdote, every framework, every principle.
- For each section, write a 1-line description of what it covers.
- Aim for 25-40 sections to cover the book thoroughly. Longer, denser books should have more sections.

OUTPUT FORMAT (JSON only, no other text):
{
  "book_title": "${bookTitle}",
  "author": "${author}",
  "total_sections": <number>,
  "outline": [
    { "section": 1, "title": "Section Title", "covers": "Brief description of what this section will cover" },
    ...
  ]
}`;

        if (onProgress) onProgress('Analyzing book structure...');
        const outline = await this._callGemini(outlinePrompt);
        const sections = outline.outline || [];
        const totalSections = sections.length || 25;

        /*  STEP 2: Generate content in batches of 8-10 sections.
         *  Each batch gets full context of the outline so the narrative flows. */
        const BATCH_SIZE = 8;
        const allPages = [];
        const batches = [];
        for (let i = 0; i < totalSections; i += BATCH_SIZE) {
            batches.push(sections.slice(i, i + BATCH_SIZE));
        }

        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            const startNum = b * BATCH_SIZE + 1;
            const isFirst = b === 0;
            const isLast = b === batches.length - 1;

            if (onProgress) onProgress(`Writing pages ${startNum}-${startNum + batch.length - 1} of ${totalSections}...`);

            const batchPrompt = `
You are writing a comprehensive, flowing summary of "${bookTitle}" by ${author}.
This is batch ${b + 1} of ${batches.length}. You are writing pages ${startNum} to ${startNum + batch.length - 1} out of ${totalSections} total.

FULL BOOK OUTLINE (for context and flow):
${JSON.stringify(sections.map(s => s.title), null, 1)}

YOUR SECTIONS TO WRITE NOW:
${JSON.stringify(batch, null, 2)}

WRITING GUIDELINES:
- Write PURELY about the book's content — its ideas, stories, frameworks, principles, examples.
- Do NOT mention any user goals, tasks, personal context, or "how this helps you" language.
- Write in a smooth, narrative, engaging style — like a premium Blinkist or Shortform summary.
- Each page should have 3-5 substantial paragraphs of real content (300-500 words per page).
- Include the author's actual examples, stories, research citations, and anecdotes where relevant.
- Preserve the book's original voice and key quotes where memorable.
- Transition smoothly between ideas — each page should flow naturally into the next.
${isFirst ? '- Start with a compelling opening that captures the essence of the book.' : '- Continue naturally from where the previous batch left off.'}
${isLast ? '- End with a powerful closing that ties together all the book\'s major themes.' : ''}

OUTPUT FORMAT (JSON only, no other text):
{
  "pages": [
    {
      "page_number": ${startNum},
      "title": "Section Title",
      "content": "Full rich content with multiple paragraphs separated by \\n\\n ...",
      "key_points": ["key insight 1", "key insight 2", "key insight 3"]
    },
    ... (${batch.length} pages)
  ]${isLast ? `,
  "key_takeaways": ["The 8-10 most important takeaways from the ENTIRE book"],
  "memorable_quotes": ["Notable direct quotes from the book"]` : ''}
}`;

            const batchResult = await this._callGemini(batchPrompt);
            if (batchResult.pages) {
                allPages.push(...batchResult.pages);
            }

            // Capture final-batch extras
            if (isLast && batchResult.key_takeaways) {
                allPages._takeaways = batchResult.key_takeaways;
                allPages._quotes = batchResult.memorable_quotes || [];
            }
        }

        if (onProgress) onProgress('Finalizing summary...');

        return {
            book_title: bookTitle,
            author: author,
            pages: allPages,
            key_takeaways: allPages._takeaways || [],
            memorable_quotes: allPages._quotes || [],
            overall_action_plan: [] // No action plan — this is pure book content
        };
    },

    // ── Separate: How to apply a specific book to user's goals ──
    generateBookApplicationTips: async function (bookTitle, author, userGoals) {
        if (!userGoals || !userGoals.length) return null;
        const prompt = `
Based on the book "${bookTitle}" by ${author}, suggest how the reader can apply its ideas to their specific goals:
${JSON.stringify(userGoals)}

Return JSON: { "recommendations": [ { "goal": "...", "ideas": ["idea1", "idea2", "idea3"] } ] }`;
        return await this._callGemini(prompt);
    },



    // Prompt Templates
    constructPrompt: function (context, data) {
        const safeJSON = (obj) => JSON.stringify(obj || {}, null, 2);

        const coreInstruction = `
You are PersonalOS Intelligence, the user's dedicated Chief of Staff.
Your goal is to provide sharp, data-driven analysis and immediate actionable advice.

CRITICAL OUTPUT FORMAT:
You must strictly follow this structure. Do not add introductions or conclusions.

**Analysis**
[Deep dive into the data. Identify patterns, deviations from goals, or notable achievements. Be specific with numbers/names.]

**Next Steps**
[Provide 2-3 concrete, actionable steps the user should take right now. Use bullet points.]
`;

        let specificContext = "";
        let dataDump = "";

        switch (context) {
            case 'dashboard':
            case 'dashboard_hyper':
                specificContext = "Context: Overall Life Dashboard (Tasks, Habits, Mood). Look for correlations between mood/energy and productivity.";
                dataDump = `
Settings: ${safeJSON(data.settings)}
Diary: ${safeJSON(data.diary)}
Tasks: ${safeJSON(data.tasks)}
Habits: ${safeJSON(data.habits)}
`;
                break;

            case 'people':
                specificContext = "Context: Relationship Management (CRM). Analyze network health and connection frequency.";
                dataDump = `People: ${safeJSON(data.people)}`;
                break;

            case 'finance':
                specificContext = "Context: Financial Health. Analyze spending against budgets and identify saving opportunities.";
                dataDump = `
Expenses: ${safeJSON(data.expenses)}
Budget Settings: ${safeJSON(data.budget)}
`;
                break;

            case 'tasks':
                specificContext = "Context: Task Execution. Prioritize the list based on urgency and importance.";
                dataDump = `Tasks: ${safeJSON(data.tasks)}`;
                break;

            case 'habits':
                specificContext = "Context: Habit Formation. Analyze consistency and streaks.";
                dataDump = `
Habits: ${safeJSON(data.habits)}
Logs: ${safeJSON(data.habit_logs)}
`;
                break;

            case 'diary':
                specificContext = "Context: Emotional Well-being. Reflect on recent entries.";
                dataDump = `Entries: ${safeJSON(data.diary)}`;
                break;

            case 'vision':
                specificContext = "Context: Long-term Goals. Connect daily actions to these goals.";
                dataDump = `Vision Board: ${safeJSON(data.vision)}`;
                break;

            default:
                specificContext = `Context: General Analysis of ${context}.`;
                dataDump = `Data: ${safeJSON(data)}`;
        }

        return `${coreInstruction}\n\n${specificContext}\n\nDATA:\n${dataDump}`;
    }
};
