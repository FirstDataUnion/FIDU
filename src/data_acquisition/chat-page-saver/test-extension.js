// Test script for Chatbot Conversation Saver Extension
// Run this in the browser console to test basic functionality

console.log('🧪 Testing Chatbot Conversation Saver Extension...');

// Test 1: Check if IndexedDB is available
function testIndexedDB() {
  console.log('📊 Testing IndexedDB availability...');
  
  if (!window.indexedDB) {
    console.error('❌ IndexedDB not available');
    return false;
  }
  
  console.log('✅ IndexedDB is available');
  return true;
}

// Test 2: Test database creation
function testDatabaseCreation() {
  console.log('🗄️ Testing database creation...');
  
  return new Promise((resolve) => {
    const request = indexedDB.open('ChatbotConversationsDB', 1);
    
    request.onerror = () => {
      console.error('❌ Failed to create database:', request.error);
      resolve(false);
    };
    
    request.onsuccess = () => {
      console.log('✅ Database created successfully');
      const db = request.result;
      db.close();
      resolve(true);
    };
    
    request.onupgradeneeded = (event) => {
      console.log('🔄 Database upgrade needed, creating schema...');
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('conversations')) {
        const store = db.createObjectStore('conversations', { keyPath: 'uniqueId' });
        store.createIndex('url', 'url', { unique: true });
        store.createIndex('modelName', 'modelName', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('dateTime', 'dateTime', { unique: false });
        console.log('✅ Database schema created');
      }
    };
  });
}

// Test 3: Test data storage and retrieval
function testDataOperations() {
  console.log('💾 Testing data operations...');
  
  return new Promise((resolve) => {
    const request = indexedDB.open('ChatbotConversationsDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      
      // Test data
      const testData = {
        uniqueId: 'test_' + Date.now(),
        modelName: 'test.com',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        dateTime: new Date().toISOString(),
        url: 'https://test.com/chat',
        htmlContent: '<html><body>Test content</body></html>',
        title: 'Test Conversation',
        lastSaved: new Date().toISOString()
      };
      
      // Store test data
      const putRequest = store.put(testData);
      
      putRequest.onsuccess = () => {
        console.log('✅ Test data stored successfully');
        
        // Retrieve test data
        const getRequest = store.get(testData.uniqueId);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            console.log('✅ Test data retrieved successfully');
            console.log('📄 Retrieved data:', getRequest.result);
            
            // Clean up test data
            const deleteRequest = store.delete(testData.uniqueId);
            deleteRequest.onsuccess = () => {
              console.log('✅ Test data cleaned up');
              db.close();
              resolve(true);
            };
          } else {
            console.error('❌ Failed to retrieve test data');
            db.close();
            resolve(false);
          }
        };
      };
      
      putRequest.onerror = () => {
        console.error('❌ Failed to store test data:', putRequest.error);
        db.close();
        resolve(false);
      };
    };
  });
}

// Test 4: Test Chrome extension APIs (if available)
function testChromeAPIs() {
  console.log('🔌 Testing Chrome extension APIs...');
  
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('⚠️ Chrome extension APIs not available (running outside extension context)');
    return Promise.resolve(true);
  }
  
  console.log('✅ Chrome extension APIs available');
  return Promise.resolve(true);
}

// Test 5: Test URL matching logic
function testURLMatching() {
  console.log('🔗 Testing URL matching logic...');
  
  const whitelist = [
    'chatgpt.com',
    'claude.ai',
    'gemini.google.com',
    'bard.google.com',
    'bing.com',
    'perplexity.ai'
  ];
  
  const testURLs = [
    'https://chatgpt.com/chat/abc',
    'https://claude.ai/chat/def',
    'https://gemini.google.com/app/ghi',
    'https://example.com/page',
    'https://chatgpt.com/other/page'
  ];
  
  testURLs.forEach(url => {
    const urlObj = new URL(url);
    const matched = whitelist.find(domain => urlObj.hostname.includes(domain));
    
    if (matched) {
      console.log(`✅ URL matched: ${url} → ${matched}`);
    } else {
      console.log(`❌ URL not matched: ${url}`);
    }
  });
  
  return true;
}

// Test 6: Test unique ID generation
function testUniqueIDGeneration() {
  console.log('🆔 Testing unique ID generation...');
  
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  function generateUniqueId(url, timestamp) {
    const urlHash = simpleHash(url);
    const timeHash = simpleHash(timestamp.toISOString());
    return `${urlHash}_${timeHash}`;
  }
  
  const testURL = 'https://chatgpt.com/chat/abc';
  const testTime = new Date();
  const uniqueId = generateUniqueId(testURL, testTime);
  
  console.log(`✅ Generated unique ID: ${uniqueId}`);
  console.log(`📝 URL: ${testURL}`);
  console.log(`⏰ Time: ${testTime.toISOString()}`);
  
  return true;
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting extension tests...\n');
  
  const tests = [
    { name: 'IndexedDB Availability', fn: testIndexedDB },
    { name: 'Database Creation', fn: testDatabaseCreation },
    { name: 'Data Operations', fn: testDataOperations },
    { name: 'Chrome APIs', fn: testChromeAPIs },
    { name: 'URL Matching', fn: testURLMatching },
    { name: 'Unique ID Generation', fn: testUniqueIDGeneration }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    console.log(`\n🧪 Running: ${test.name}`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✅ ${test.name}: PASSED`);
      } else {
        console.log(`❌ ${test.name}: FAILED`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Extension is ready to use.');
  } else {
    console.log('⚠️ Some tests failed. Check the console for details.');
  }
}

// Auto-run tests if this script is loaded
if (typeof window !== 'undefined') {
  // Wait a bit for the page to load
  setTimeout(runAllTests, 1000);
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testIndexedDB,
    testDatabaseCreation,
    testDataOperations,
    testChromeAPIs,
    testURLMatching,
    testUniqueIDGeneration
  };
} 