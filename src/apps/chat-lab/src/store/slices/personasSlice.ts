import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface Persona {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  contextIds: string[];
  preferences: {
    preferredModels: string[];
    defaultSystemPrompt: string;
    communicationStyle: 'formal' | 'casual' | 'technical' | 'creative';
    expertise: string[];
  };
  isActive: boolean;
  conversationCount: number;
  createdAt: string;
  lastUsed: string;
}

export interface PersonasState {
  items: Persona[];
  activePersonaId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: PersonasState = {
  items: [],
  activePersonaId: null,
  loading: false,
  error: null,
};

// Mock data
const mockPersonas: Persona[] = [
  {
    id: 'persona-1',
    name: 'Frontend Developer',
    description: 'Focused on React, TypeScript, and modern web development',
    avatar: '👨‍💻',
    contextIds: ['ctx-1'],
    preferences: {
      preferredModels: ['claude-3-sonnet', 'gpt-4-turbo'],
      defaultSystemPrompt: 'sys-1',
      communicationStyle: 'technical',
      expertise: ['React', 'TypeScript', 'CSS', 'JavaScript', 'HTML']
    },
    isActive: true,
    conversationCount: 45,
    createdAt: new Date('2024-01-10').toISOString(),
    lastUsed: new Date('2024-01-15').toISOString()
  },
  {
    id: 'persona-2',
    name: 'Backend Developer',
    description: 'API design, databases, and server-side architecture',
    avatar: '⚙️',
    contextIds: ['ctx-2', 'ctx-3'],
    preferences: {
      preferredModels: ['claude-3-opus', 'gpt-4'],
      defaultSystemPrompt: 'sys-3',
      communicationStyle: 'technical',
      expertise: ['Python', 'Node.js', 'PostgreSQL', 'MongoDB', 'Docker', 'AWS']
    },
    isActive: false,
    conversationCount: 32,
    createdAt: new Date('2024-01-05').toISOString(),
    lastUsed: new Date('2024-01-12').toISOString()
  },
  {
    id: 'persona-3',
    name: 'Tech Lead',
    description: 'Architecture decisions, team leadership, and project planning',
    avatar: '🏗️',
    contextIds: ['ctx-1', 'ctx-2'],
    preferences: {
      preferredModels: ['claude-3-opus', 'gpt-4-turbo'],
      defaultSystemPrompt: 'sys-1',
      communicationStyle: 'formal',
      expertise: ['System Architecture', 'Team Management', 'Project Planning', 'Technical Strategy']
    },
    isActive: false,
    conversationCount: 28,
    createdAt: new Date('2024-01-08').toISOString(),
    lastUsed: new Date('2024-01-13').toISOString()
  },
  {
    id: 'persona-4',
    name: 'Data Scientist',
    description: 'Machine learning, data analysis, and statistical modeling',
    avatar: '📊',
    contextIds: ['ctx-4'],
    preferences: {
      preferredModels: ['claude-3-opus', 'gemini-ultra'],
      defaultSystemPrompt: 'sys-1',
      communicationStyle: 'technical',
      expertise: ['Python', 'R', 'Machine Learning', 'Statistics', 'Data Visualization', 'SQL']
    },
    isActive: false,
    conversationCount: 15,
    createdAt: new Date('2024-01-12').toISOString(),
    lastUsed: new Date('2024-01-14').toISOString()
  },
  {
    id: 'persona-5',
    name: 'UI/UX Designer',
    description: 'User experience design and interface prototyping',
    avatar: '🎨',
    contextIds: [],
    preferences: {
      preferredModels: ['claude-3-sonnet', 'gpt-4'],
      defaultSystemPrompt: 'sys-4',
      communicationStyle: 'creative',
      expertise: ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Accessibility']
    },
    isActive: false,
    conversationCount: 12,
    createdAt: new Date('2024-01-14').toISOString(),
    lastUsed: new Date('2024-01-14').toISOString()
  }
];

// Async actions
export const fetchPersonas = createAsyncThunk(
  'personas/fetchPersonas',
  async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockPersonas;
  }
);

export const createPersona = createAsyncThunk(
  'personas/createPersona',
  async (personaData: Partial<Persona>) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    const newPersona: Persona = {
      id: `persona-${Date.now()}`,
      name: personaData.name || 'New Persona',
      description: personaData.description || '',
      avatar: personaData.avatar || '👤',
      contextIds: [],
      preferences: personaData.preferences || {
        preferredModels: ['claude-3-sonnet'],
        defaultSystemPrompt: 'sys-1',
        communicationStyle: 'technical',
        expertise: []
      },
      isActive: false,
      conversationCount: 0,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    return newPersona;
  }
);

export const updatePersona = createAsyncThunk(
  'personas/updatePersona',
  async ({ id, data }: { id: string; data: Partial<Persona> }) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    return { id, data };
  }
);

export const deletePersona = createAsyncThunk(
  'personas/deletePersona',
  async (id: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    return id;
  }
);

export const switchPersona = createAsyncThunk(
  'personas/switchPersona',
  async (personaId: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 200));
    return personaId;
  }
);

const personasSlice = createSlice({
  name: 'personas',
  initialState,
  reducers: {
    setActivePersona: (state, action: PayloadAction<string | null>) => {
      // Deactivate all personas
      state.items.forEach(persona => {
        persona.isActive = false;
      });
      
      // Activate selected persona
      if (action.payload) {
        const persona = state.items.find(p => p.id === action.payload);
        if (persona) {
          persona.isActive = true;
          persona.lastUsed = new Date().toISOString();
          state.activePersonaId = action.payload;
        }
      } else {
        state.activePersonaId = null;
      }
    },
    incrementConversationCount: (state, action: PayloadAction<string>) => {
      const persona = state.items.find(p => p.id === action.payload);
      if (persona) {
        persona.conversationCount += 1;
        persona.lastUsed = new Date().toISOString();
      }
    },
    addContextToPersona: (state, action: PayloadAction<{ personaId: string; contextId: string }>) => {
      const persona = state.items.find(p => p.id === action.payload.personaId);
      if (persona && !persona.contextIds.includes(action.payload.contextId)) {
        persona.contextIds.push(action.payload.contextId);
      }
    },
    removeContextFromPersona: (state, action: PayloadAction<{ personaId: string; contextId: string }>) => {
      const persona = state.items.find(p => p.id === action.payload.personaId);
      if (persona) {
        persona.contextIds = persona.contextIds.filter(id => id !== action.payload.contextId);
      }
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPersonas.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPersonas.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        // Set the first active persona as current active
        const activePersona = action.payload.find(p => p.isActive);
        if (activePersona) {
          state.activePersonaId = activePersona.id;
        }
      })
      .addCase(fetchPersonas.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch personas';
      })
      .addCase(createPersona.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updatePersona.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...action.payload.data };
        }
      })
      .addCase(deletePersona.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
        if (state.activePersonaId === action.payload) {
          state.activePersonaId = null;
        }
      })
      .addCase(switchPersona.fulfilled, (state, action) => {
        // Deactivate all personas
        state.items.forEach(persona => {
          persona.isActive = false;
        });
        
        // Activate selected persona
        const persona = state.items.find(p => p.id === action.payload);
        if (persona) {
          persona.isActive = true;
          persona.lastUsed = new Date().toISOString();
          state.activePersonaId = action.payload;
        }
      });
  },
});

export const {
  setActivePersona,
  incrementConversationCount,
  addContextToPersona,
  removeContextFromPersona,
  clearError
} = personasSlice.actions;

export default personasSlice.reducer; 