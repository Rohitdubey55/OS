/* ai-service.js */

const AI_SERVICE = {
    // Default Configuration
    defaultModel: 'gemini-1.5-flash',

    // Get Configuration from State (Sheet Source of Truth)
    getConfig: function () {
        const fromState = state.data.settings?.[0];

        return {
            apiKey: fromState?.ai_api_key || '',
            model: fromState?.ai_model || this.defaultModel
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

    // Get personalized book recommendations
    generateBookRecommendations: async function (userData) {
        const config = this.getConfig();
        if (!config.apiKey) throw new Error("Missing API Key.");

        const prompt = `
Analyze the user's goals, habits, and interests from the provided data below.
Recommend 5-8 highly relevant books that would specifically help them achieve their goals or improve their life based on their habits and diary reflections.

For each book, provide:
- Title and Author
- Why it's relevant (referencing specific goals/diary/habits)
- Key benefit they'll gain
- Category/Genre

DATA CONTEXT:
Vision Board Goals: ${JSON.stringify(userData.vision || [])}
Active Habits: ${JSON.stringify(userData.habits || [])}
Recent Diary Reflections: ${JSON.stringify(userData.diary?.slice(0, 5) || [])}
Tasks: ${JSON.stringify(userData.tasks?.slice(0, 10) || [])}

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

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (!response.ok) throw new Error('AI Recommendation Failed');
            const result = await response.json();
            let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            // Clean up JSON if LLM added markdown blocks
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);
        } catch (error) {
            console.error("Recommendation Error:", error);
            throw error;
        }
    },

    // Generate 15-page summary
    generateBookSummary: async function (bookTitle, author, userGoals) {
        const config = this.getConfig();
        if (!config.apiKey) throw new Error("Missing API Key.");

        const prompt = `
Generate a comprehensive, actionable 15-page summary of "${bookTitle}" by ${author}.
Focus specifically on how the core ideas in this book can help the user achieve their goals: ${JSON.stringify(userGoals || [])}.

STRUCTURE REQUIRED (15 Distinct Sections/Pages):
Page 1-2: Book Overview & Core Thesis.
Page 3-4: Key Concepts Part 1 (The psychological or practical foundation).
Page 5-6: Key Concepts Part 2 (Methodology and frameworks).
Page 7-8: Advanced Strategies and Nuances.
Page 9-10: Practical Applications for Daily Life.
Page 11-12: Specific Action Items relative to user's goals.
Page 13: The author's distilled system/framework.
Page 14: Challenges & Common Pitfalls.
Page 15: Final Recap & 5 Daily Mantras/Actions.

OUTPUT FORMAT: Return a valid JSON object:
{
  "book_title": "${bookTitle}",
  "author": "${author}",
  "pages": [
    {
      "page_number": 1,
      "title": "Section Title",
      "content": "Full, deep content for this page (multiple paragraphs)...",
      "key_points": ["point1", "point2"],
      "action_items": ["action1"]
    },
    ... up to page 15
  ],
  "key_takeaways": ["overall takeaway 1", ...],
  "overall_action_plan": ["step 1", ...]
}
Ensure the content is deep and high-quality, not just bullet points. Do not include introductions, only JSON.
`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (!response.ok) throw new Error('AI Summary Failed');
            const result = await response.json();
            let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);
        } catch (error) {
            console.error("Summary Generation Error:", error);
            throw error;
        }
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
