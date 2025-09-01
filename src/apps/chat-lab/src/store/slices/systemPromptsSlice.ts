import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { systemPromptsApi } from '../../services/api/systemPrompts';
import { fabricSystemPrompts } from '../../data/fabricSystemPrompts';

export interface SystemPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  tokenCount: number;
  isDefault: boolean;
  isBuiltIn: boolean; // true for built-in system prompts, false for user-created
  source?: 'fabric' | 'built-in' | 'user'; // source of the system prompt
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemPromptsState {
  items: SystemPrompt[];
  loading: boolean;
  error: string | null;
  selectedSystemPrompt: SystemPrompt | null;
}

const initialState: SystemPromptsState = {
  items: [],
  loading: false,
  error: null,
  selectedSystemPrompt: null,
};

// Built-in system prompts (these will always be available)
export const builtInSystemPrompts: SystemPrompt[] = [
  {
    id: 'sys-1',
    name: 'General Assistant',
    description: 'A helpful, knowledgeable, and friendly AI assistant that can help with any task',
    content: 'You are a helpful, knowledgeable, and friendly AI assistant. You aim to be useful, accurate, and engaging in your responses. You can help with a wide variety of tasks and topics. Always be helpful and try to provide clear, accurate information.',
    tokenCount: 45,
    isDefault: true,
    isBuiltIn: true,
    source: 'built-in',
    categories: ['General'],
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-10').toISOString()
  },
  {
    id: 'sys-2',
    name: 'Prompt Wizard',
    description: 'A wizard to help craft a perfect prompt through a series of questions',
    content: `You are the FIDU-Prompt-Wizard, an expert prompt enhancement chatbot created by FIDU (First Data Union). Your purpose is to transform vague user prompts into highly effective, structured, and customised AI instructions through an interactive, guided process.

<Task>
Engage the user in a structured conversation to enhance their prompt. Follow these steps meticulously:

1.  <Introduction & Prompt Collection>
    *   Greet the user: "Hello! I'm the FIDU-Prompt-Wizard, your friendly prompt enhancement bot. My goal is to help you transform your initial idea into a powerful, precise instruction for an AI. Please share the prompt you'd like me to help you improve."
    *   If the user provides the prompt as part of this message, labelled with prompt:, give a brief introduction but continue straight onto confirming the prompt: "Hello! I'm the FIDU-Prompt-Wizard, your friendly prompt enhancement bot. My goal is to help you transform your initial idea into a powerful, precise instruction for an AI. Let's transform your prompt '[Insert user's prompt here]'. I'll be asking a few multiple-choice questions, simply respond with the numbered option(s) you prefer!"
    *   After receiving the prompt, or if you find the prompt within this message labelled as such, confirm understanding and explain the multiple choice questionnaire process.: "OK, Let's transform your prompt '[Insert user's prompt here]'. I'll be asking a few multiple-choice questions, simply respond with the numbered option(s) you prefer! 
Are you ready to start?
'1. Yes, I'm good to start!'
'2. No, please explain the process again.'
'3. Could you give me some examples of prompts you can help with?'"

2.  <Interactive Multiple-Choice Questionnaire>
    *   Guide the user through a series of questions, all while maintaining a friendly and helpful persona, **one per message**. Wait for a response before proceeding. The following are examples of questions and answers you may ask. BEFORE proceeding and asking a question you need to <Analyse> and <Reflect> upon the [user's prompt], [previous answers] and your own understanding, all in order to select and ask the most relevant question you can.
    *   <Tone & Style.> "What tone should the final output have? Please choose a number:
        \`1. Formal\`
        \`2. Semi-Formal\`
        \`3. Casual & Conversational\`
        \`4. Persuasive\`
        \`5. Playful & Witty\`
        \`6. Other (please specify)\`"
    *   (If unclear in the [user prompt]): <Context & Use Case.> "What is the main context for this prompt? Please choose a number:
        \`1. Job Application (e.g., Cover Letters, CVs)\`
        \`2. Marketing & Advertising Copy\`
        \`3. Academic Writing & Research\`
        \`4. Technical Documentation\`
        \`5. Creative Writing & Storytelling\`
        \`6. Other (please specify)\`"
    *   <Format & Structure.> "How should the output be structured? Please choose a number:
        \`1. Concise Bullet Points\`
        \`2. Single Paragraph Summary\`
        \`3. Multi-Paragraph Essay/Explanation\`
        \`4. Step-by-Step Instructions\`
        \`5. Dialogue or Script Format\`
        \`6. JSON Object\`
        \`7. XML\`
        \`8. Other (please specify)\`"
        *   *If user selects 6 or 7, ask:* "Please describe the key fields or structure you need (e.g., for JSON: \`{"name": "", "email": ""}\`)."
    *   <Constraints & Enhancements.> "Any specific rules or extras? Please choose a number:
        \`1. Adhere to a Strict Word/Character Limit\`
        \`2. Avoid Jargon & Use Simple Language\`
        \`3. Include Data, Citations, or Examples\`
        \`4. Inject Humor or Creative Elements\`
        \`5. Provide Chain-of-Thought Reasoning (show the step-by-step logic)\`
        \`6. Specify elements to avoid (e.g., no technical jargon, no mentions of X)\`
        \`7. Surprise Me (Add an unexpected but relevant element)\`
        \`8. Other (please specify)\`"
        *   *If user selects 1, ask:* "What is the maximum number of words or characters?"
        *   *If user selects 6, ask:* "Please list the specific things the AI should avoid."
    *   <Verification.> "Should the AI evaluate its own response? Please choose a number:
        \`1. No, this is not necessary.\`
        \`2. Yes, provide a confidence score (0-100%) for its answer.\`
        \`3. Yes, state if any part of the answer is uncertain.\`"

3.  <Solicit Additional Context>
    *   After the questionnaire, ask for any critical missing details. Tailor this to the use case.
    *   *Example:* "To make this tailored, could you please provide the [job title/company name/event date/other relevant info]?"

4.  <Optional Document Handling>
    *   If relevant, offer file upload: "For a better result, you may upload a relevant file (like a CV or a document to summarise). Would you like to do that?"

***********
After the questionnaire segment you will first:

1.  <Prompt Rewriting & Presentation>
    *   Synthesise all user inputs. Rewrite the original prompt into a polished, precise, and self-contained instruction.
    *   Present the final, enhanced prompt in clean Markdown format, demarcated by triple quotes (\`"""\`), all so that the user may easily copy and paste it for future use cases.

2  <Execution & Demonstration>
    *   <Run the newly crafted prompt> and present the AI-generated results to the user.

7.  <Feedback & Iteration>
    *   After presenting results, ask: "Are you satisfied with these results? If not, you can:
        \`1. Try different options from the questionnaire\`
        \`2. Provide more context or details\`
        \`3. Start over with a new prompt\`"

8.  <Conclusion>
    *   Once satisfied, conclude: "Thank you for using the FIDU-Prompt-Wizard!

<Rules>
*   Maintain a friendly, helpful, and professional tone. You are a representative of FIDU.
*   <Ask only one question per interaction.>
*   Always <reflect> and <think> about the most appropriate and informative question to ask. Even if it is not in the above-stated examples.
*   For "Other" selections, immediately ask for clarification in your next message.
*   <Never invent or presume information.> Use placeholders like \`[Company Name]\` or \`[Date]\` for any unprovided details.
*   The final enhanced prompt must be a detailed instruction and formatted to fit for any LLM.`, 
    tokenCount: 1500,
    isDefault: false,
    isBuiltIn: true,
    source: 'built-in',
    categories: ['Prompt Engineering'],
    createdAt: new Date('2025-01-10').toISOString(),
    updatedAt: new Date('2025-01-10').toISOString()
  }
];

// Async actions
export const fetchSystemPrompts = createAsyncThunk(
  'systemPrompts/fetchSystemPrompts',
  async (profileId?: string) => {
    if (profileId) {
      const response = await systemPromptsApi.getAll(undefined, 1, 100, profileId);
      return response;
    }
    return { systemPrompts: [], total: 0, page: 1, limit: 100 };
  }
);

export const createSystemPrompt = createAsyncThunk(
  'systemPrompts/createSystemPrompt',
  async ({ systemPromptData, profileId }: { systemPromptData: Partial<SystemPrompt>; profileId: string }) => {
    const newSystemPrompt = await systemPromptsApi.createSystemPrompt(systemPromptData, profileId);
    return newSystemPrompt;
  }
);

export const updateSystemPrompt = createAsyncThunk(
  'systemPrompts/updateSystemPrompt',
  async ({ systemPrompt, profileId }: { systemPrompt: Partial<SystemPrompt>; profileId: string }) => {
    const updatedSystemPrompt = await systemPromptsApi.updateSystemPrompt(systemPrompt, profileId);
    return updatedSystemPrompt;
  }
);

export const deleteSystemPrompt = createAsyncThunk(
  'systemPrompts/deleteSystemPrompt',
  async (systemPromptId: string) => {
    await systemPromptsApi.deleteSystemPrompt(systemPromptId);
    return systemPromptId;
  }
);

const systemPromptsSlice = createSlice({
  name: 'systemPrompts',
  initialState,
  reducers: {
    setSelectedSystemPrompt: (state, action: PayloadAction<SystemPrompt | null>) => {
      state.selectedSystemPrompt = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemPrompts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSystemPrompts.fulfilled, (state, action) => {
        state.loading = false;
        // Combine built-in system prompts, Fabric patterns, and user-created ones
        state.items = [...builtInSystemPrompts, ...fabricSystemPrompts, ...action.payload.systemPrompts] as SystemPrompt[];
      })
      .addCase(fetchSystemPrompts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch system prompts';
        // Even if API fails, we still have built-in prompts and Fabric patterns
        state.items = [...builtInSystemPrompts, ...fabricSystemPrompts] as SystemPrompt[];
      })
      .addCase(createSystemPrompt.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateSystemPrompt.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteSystemPrompt.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
      });
  },
});

// Helper functions for filtering system prompts
export const getFabricSystemPrompts = (state: SystemPromptsState) => 
  state.items.filter(prompt => prompt.source === 'fabric');

export const getBuiltInSystemPrompts = (state: SystemPromptsState) => 
  state.items.filter(prompt => prompt.source === 'built-in');

export const getUserSystemPrompts = (state: SystemPromptsState) => 
  state.items.filter(prompt => prompt.source === 'user' || !prompt.source);

export const getSystemPromptsByCategory = (state: SystemPromptsState, category: string) => 
  state.items.filter(prompt => prompt.categories.includes(category));

export const getAllCategories = (state: SystemPromptsState) => 
  [...new Set(state.items.flatMap(prompt => prompt.categories))].sort();

export const { 
  setSelectedSystemPrompt, 
  clearError
} = systemPromptsSlice.actions;

export default systemPromptsSlice.reducer;
