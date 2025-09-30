/**
 * File System Storage Demo Component
 * Demonstrates FileSystemStorageAdapter integration with existing storage infrastructure
 */

import React, { useState, useEffect } from 'react';
import { FileSystemStorageAdapter } from '../../services/storage/adapters/FileSystemStorageAdapter';
import { BrowserCompatibility } from '../../utils/browserCompatibility';

interface DemoState {
  compatibility: ReturnType<typeof BrowserCompatibility.getCompatibilityInfo>;
  adapter: FileSystemStorageAdapter | null;
  directoryInfo: any;
  isInitialized: boolean;
  error: string | null;
  testResults: {
    createConversation: boolean | null;
    getConversations: boolean | null;
    directoryAccess: boolean | null;
  };
}

export const FileSystemStorageDemo: React.FC = () => {
  const [state, setState] = useState<DemoState>({
    compatibility: BrowserCompatibility.getCompatibilityInfo(),
    adapter: null,
    directoryInfo: null,
    isInitialized: false,
    error: null,
    testResults: {
      createConversation: null,
      getConversations: null,
      directoryAccess: null,
    }
  });

  useEffect(() => {
    initializeAdapter();
  }, []);

  const initializeAdapter = async () => {
    try {
      const adapter = new FileSystemStorageAdapter({ mode: 'filesystem' });
      await adapter.initialize();
      
      setState(prev => ({
        ...prev,
        adapter,
        isInitialized: true,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize adapter'
      }));
    }
  };

  const requestDirectoryAccess = async () => {
    if (!state.adapter) return;

    try {
      const result = await state.adapter.requestDirectoryAccess();
      if (result.success) {
        const directoryInfo = state.adapter.getDirectoryInfo();
        setState(prev => ({
          ...prev,
          directoryInfo,
          error: null,
          testResults: {
            ...prev.testResults,
            directoryAccess: true
          }
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to access directory'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to request directory access'
      }));
    }
  };

  const clearDirectoryAccess = async () => {
    if (!state.adapter) return;

    try {
      await state.adapter.clearDirectoryAccess();
      setState(prev => ({
        ...prev,
        directoryInfo: null,
        testResults: {
          createConversation: null,
          getConversations: null,
          directoryAccess: null,
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to clear directory access'
      }));
    }
  };

  const testCreateConversation = async () => {
    if (!state.adapter || !state.adapter.isDirectoryAccessible()) return;

    try {
      const conversation = await state.adapter.createConversation(
        'test-profile',
        { title: 'Test Conversation' },
        [{
          id: 'test-message-1',
          conversationId: 'test-conversation',
          role: 'user',
          content: 'Hello, this is a test message',
          timestamp: new Date().toISOString(),
          platform: 'test',
          attachments: [],
          isEdited: false
        }]
      );

      setState(prev => ({
        ...prev,
        testResults: {
          ...prev.testResults,
          createConversation: !!conversation.id
        },
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create conversation',
        testResults: {
          ...prev.testResults,
          createConversation: false
        }
      }));
    }
  };

  const testGetConversations = async () => {
    if (!state.adapter || !state.adapter.isDirectoryAccessible()) return;

    try {
      const result = await state.adapter.getConversations();
      setState(prev => ({
        ...prev,
        testResults: {
          ...prev.testResults,
          getConversations: Array.isArray(result.conversations)
        },
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to get conversations',
        testResults: {
          ...prev.testResults,
          getConversations: false
        }
      }));
    }
  };

  const getStatusColor = (status: boolean | null) => {
    if (status === null) return 'text-gray-500';
    return status ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return '⏳';
    return status ? '✅' : '❌';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">File System Storage Demo</h2>
      
      {/* Browser Compatibility */}
      <div className="mb-6 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Browser Compatibility</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={getStatusIcon(state.compatibility.fileSystemAccess.supported)}>
              {getStatusIcon(state.compatibility.fileSystemAccess.supported)}
            </span>
            <span className={getStatusColor(state.compatibility.fileSystemAccess.supported)}>
              File System Access API: {state.compatibility.fileSystemAccess.supported ? 'Supported' : 'Not Supported'}
            </span>
          </div>
          <p className="text-sm text-gray-600">{state.compatibility.fileSystemAccess.message}</p>
        </div>
      </div>

      {/* Adapter Status */}
      <div className="mb-6 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Adapter Status</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span>{state.isInitialized ? '✅' : '❌'}</span>
            <span>Initialized: {state.isInitialized ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{state.adapter?.isDirectoryAccessible() ? '✅' : '❌'}</span>
            <span>Directory Accessible: {state.adapter?.isDirectoryAccessible() ? 'Yes' : 'No'}</span>
          </div>
          {state.directoryInfo && (
            <div className="text-sm text-gray-600">
              Selected Directory: {state.directoryInfo.path}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded-lg">
          <h4 className="font-semibold text-red-800 mb-2">Error</h4>
          <p className="text-red-700">{state.error}</p>
        </div>
      )}

      {/* Directory Access Controls */}
      <div className="mb-6 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Directory Access</h3>
        <div className="space-x-4">
          <button
            onClick={requestDirectoryAccess}
            disabled={!state.isInitialized || state.adapter?.isDirectoryAccessible()}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Select Directory
          </button>
          <button
            onClick={clearDirectoryAccess}
            disabled={!state.adapter?.isDirectoryAccessible()}
            className="px-4 py-2 bg-gray-600 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Clear Directory
          </button>
        </div>
      </div>

      {/* Test Operations */}
      <div className="mb-6 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Test Operations</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{getStatusIcon(state.testResults.directoryAccess)}</span>
              <span>Directory Access</span>
            </div>
            <button
              onClick={requestDirectoryAccess}
              disabled={!state.isInitialized}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:bg-gray-400"
            >
              Test
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{getStatusIcon(state.testResults.createConversation)}</span>
              <span>Create Conversation</span>
            </div>
            <button
              onClick={testCreateConversation}
              disabled={!state.adapter?.isDirectoryAccessible()}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:bg-gray-400"
            >
              Test
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{getStatusIcon(state.testResults.getConversations)}</span>
              <span>Get Conversations</span>
            </div>
            <button
              onClick={testGetConversations}
              disabled={!state.adapter?.isDirectoryAccessible()}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:bg-gray-400"
            >
              Test
            </button>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="p-4 border rounded-lg bg-blue-50">
        <h3 className="text-lg font-semibold mb-3">Usage Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Ensure you're using Chrome, Edge, or another Chromium-based browser</li>
          <li>Click "Select Directory" to choose where to store your data</li>
          <li>Test the basic operations to verify everything works</li>
          <li>The adapter will create SQLite database files in your selected directory</li>
          <li>Files will persist between browser sessions</li>
        </ol>
      </div>
    </div>
  );
};
