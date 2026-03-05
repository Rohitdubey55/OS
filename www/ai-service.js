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
