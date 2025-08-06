import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface Context {
  id: string;
  name: string;
  description: string;
  conversationIds: string[];
  fileIds: string[];
  linkIds: string[];
  lastUpdated: Date;
  tokenCount: number;
  personas: string[];
  createdAt: Date;
  isActive: boolean;
  subContexts: string[];
  manualNotes: string;
}

export interface ContextFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  tokenCount: number;
}

export interface ContextLink {
  id: string;
  url: string;
  title: string;
  description: string;
  addedAt: Date;
  tokenCount: number;
}

export interface ContextsState {
  items: Context[];
  files: ContextFile[];
  links: ContextLink[];
  loading: boolean;
  error: string | null;
  selectedContext: Context | null;
}

const initialState: ContextsState = {
  items: [],
  files: [],
  links: [],
  loading: false,
  error: null,
  selectedContext: null,
};

// Mock data
const mockContexts: Context[] = [
  {
    id: 'ctx-1',
    name: 'React Development Patterns',
    description: 'Best practices and patterns for React development including hooks, state management, and performance optimization.',
    conversationIds: ['conv-1', 'conv-2', 'conv-5'],
    fileIds: ['file-1', 'file-2'],
    linkIds: ['link-1', 'link-2'],
    lastUpdated: new Date('2024-01-15'),
    tokenCount: 4500,
    personas: ['Frontend Developer', 'Tech Lead'],
    createdAt: new Date('2024-01-10'),
    isActive: true,
    subContexts: [],
    manualNotes: 'Key patterns to remember for React apps.'
  },
  {
    id: 'ctx-2',
    name: 'API Design Guidelines',
    description: 'RESTful API design principles, GraphQL patterns, and authentication strategies.',
    conversationIds: ['conv-3', 'conv-4'],
    fileIds: ['file-3'],
    linkIds: ['link-3', 'link-4', 'link-5'],
    lastUpdated: new Date('2024-01-12'),
    tokenCount: 3200,
    personas: ['Backend Developer', 'System Architect'],
    createdAt: new Date('2024-01-05'),
    isActive: true,
    subContexts: ['ctx-3'],
    manualNotes: 'Focus on consistent error handling and clear documentation.'
  },
  {
    id: 'ctx-3',
    name: 'Authentication & Security',
    description: 'JWT implementation, OAuth flows, and security best practices.',
    conversationIds: ['conv-6'],
    fileIds: [],
    linkIds: ['link-6'],
    lastUpdated: new Date('2024-01-08'),
    tokenCount: 1800,
    personas: ['Security Engineer', 'Backend Developer'],
    createdAt: new Date('2024-01-03'),
    isActive: true,
    subContexts: [],
    manualNotes: 'Always validate tokens server-side.'
  },
  {
    id: 'ctx-4',
    name: 'Machine Learning Concepts',
    description: 'Fundamental ML concepts, neural networks, and practical implementation strategies.',
    conversationIds: ['conv-7', 'conv-8'],
    fileIds: ['file-4', 'file-5'],
    linkIds: [],
    lastUpdated: new Date('2024-01-14'),
    tokenCount: 6200,
    personas: ['Data Scientist', 'ML Engineer'],
    createdAt: new Date('2024-01-01'),
    isActive: false,
    subContexts: [],
    manualNotes: 'Start with simple models before moving to complex architectures.'
  }
];

const mockFiles: ContextFile[] = [
  {
    id: 'file-1',
    name: 'react-hooks-guide.pdf',
    size: 2400000,
    type: 'application/pdf',
    uploadedAt: new Date('2024-01-10'),
    tokenCount: 1200
  },
  {
    id: 'file-2',
    name: 'component-patterns.md',
    size: 45000,
    type: 'text/markdown',
    uploadedAt: new Date('2024-01-12'),
    tokenCount: 800
  },
  {
    id: 'file-3',
    name: 'api-specification.yaml',
    size: 120000,
    type: 'application/yaml',
    uploadedAt: new Date('2024-01-08'),
    tokenCount: 600
  },
  {
    id: 'file-4',
    name: 'ml-fundamentals.pdf',
    size: 5600000,
    type: 'application/pdf',
    uploadedAt: new Date('2024-01-05'),
    tokenCount: 2800
  },
  {
    id: 'file-5',
    name: 'neural-networks.ipynb',
    size: 890000,
    type: 'application/x-ipynb+json',
    uploadedAt: new Date('2024-01-14'),
    tokenCount: 1500
  }
];

const mockLinks: ContextLink[] = [
  {
    id: 'link-1',
    url: 'https://react.dev/learn',
    title: 'React Documentation',
    description: 'Official React documentation with latest patterns',
    addedAt: new Date('2024-01-10'),
    tokenCount: 400
  },
  {
    id: 'link-2',
    url: 'https://redux-toolkit.js.org/',
    title: 'Redux Toolkit Guide',
    description: 'Modern Redux patterns with RTK',
    addedAt: new Date('2024-01-11'),
    tokenCount: 350
  },
  {
    id: 'link-3',
    url: 'https://restfulapi.net/',
    title: 'RESTful API Design',
    description: 'Best practices for REST API design',
    addedAt: new Date('2024-01-06'),
    tokenCount: 300
  },
  {
    id: 'link-4',
    url: 'https://graphql.org/learn/',
    title: 'GraphQL Learning Guide',
    description: 'Introduction to GraphQL concepts',
    addedAt: new Date('2024-01-07'),
    tokenCount: 450
  },
  {
    id: 'link-5',
    url: 'https://oauth.net/2/',
    title: 'OAuth 2.0 Specification',
    description: 'Complete OAuth 2.0 framework documentation',
    addedAt: new Date('2024-01-08'),
    tokenCount: 600
  },
  {
    id: 'link-6',
    url: 'https://jwt.io/introduction/',
    title: 'JWT Introduction',
    description: 'JSON Web Token standards and implementation',
    addedAt: new Date('2024-01-09'),
    tokenCount: 250
  }
];

// Async actions
export const fetchContexts = createAsyncThunk(
  'contexts/fetchContexts',
  async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return { contexts: mockContexts, files: mockFiles, links: mockLinks };
  }
);

export const createContext = createAsyncThunk(
  'contexts/createContext',
  async (contextData: Partial<Context>) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    const newContext: Context = {
      id: `ctx-${Date.now()}`,
      name: contextData.name || 'New Context',
      description: contextData.description || '',
      conversationIds: [],
      fileIds: [],
      linkIds: [],
      lastUpdated: new Date(),
      tokenCount: 0,
      personas: contextData.personas || [],
      createdAt: new Date(),
      isActive: true,
      subContexts: [],
      manualNotes: ''
    };
    return newContext;
  }
);

export const updateContext = createAsyncThunk(
  'contexts/updateContext',
  async ({ id, data }: { id: string; data: Partial<Context> }) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    return { id, data };
  }
);

export const deleteContext = createAsyncThunk(
  'contexts/deleteContext',
  async (id: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    return id;
  }
);

const contextsSlice = createSlice({
  name: 'contexts',
  initialState,
  reducers: {
    setSelectedContext: (state, action: PayloadAction<Context | null>) => {
      state.selectedContext = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    addConversationToContext: (state, action: PayloadAction<{ contextId: string; conversationId: string }>) => {
      const context = state.items.find(c => c.id === action.payload.contextId);
      if (context && !context.conversationIds.includes(action.payload.conversationId)) {
        context.conversationIds.push(action.payload.conversationId);
        context.lastUpdated = new Date();
        // Mock token count increase
        context.tokenCount += 500;
      }
    },
    removeConversationFromContext: (state, action: PayloadAction<{ contextId: string; conversationId: string }>) => {
      const context = state.items.find(c => c.id === action.payload.contextId);
      if (context) {
        context.conversationIds = context.conversationIds.filter(id => id !== action.payload.conversationId);
        context.lastUpdated = new Date();
        // Mock token count decrease
        context.tokenCount = Math.max(0, context.tokenCount - 500);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContexts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContexts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.contexts;
        state.files = action.payload.files;
        state.links = action.payload.links;
      })
      .addCase(fetchContexts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch contexts';
      })
      .addCase(createContext.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(updateContext.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...action.payload.data };
        }
      })
      .addCase(deleteContext.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
      });
  },
});

export const { 
  setSelectedContext, 
  clearError, 
  addConversationToContext, 
  removeConversationFromContext 
} = contextsSlice.actions;

export default contextsSlice.reducer; 