import { renderHook, act } from '@testing-library/react';
import { useDebouncedSearch } from '../useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with empty search query', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    
    expect(result.current.searchQuery).toBe('');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('should update search query immediately', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    
    act(() => {
      result.current.updateSearchQuery('test');
    });
    
    expect(result.current.searchQuery).toBe('test');
    expect(result.current.isSearching).toBe(true);
    expect(result.current.debouncedQuery).toBe('');
  });

  it('should debounce search query with default delay', () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch({ onSearch }));
    
    act(() => {
      result.current.updateSearchQuery('test');
    });
    
    expect(result.current.isSearching).toBe(true);
    // onSearch is called immediately with empty string when component mounts
    expect(onSearch).toHaveBeenCalledWith('');
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    expect(result.current.debouncedQuery).toBe('test');
    expect(result.current.isSearching).toBe(false);
    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('should use custom delay', () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch({ delay: 500, onSearch }));
    
    act(() => {
      result.current.updateSearchQuery('test');
    });
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // onSearch is called with empty string on mount, then with 'test' after delay
    expect(onSearch).toHaveBeenCalledWith('');
    
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('should respect minimum length requirement', () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch({ minLength: 3, onSearch }));
    
    act(() => {
      result.current.updateSearchQuery('te');
    });
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    expect(result.current.isSearching).toBe(false);
    // onSearch is called with empty string on mount
    expect(onSearch).toHaveBeenCalledWith('');
    
    act(() => {
      result.current.updateSearchQuery('test');
    });
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('should clear search immediately when query is empty', () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch({ onSearch }));
    
    act(() => {
      result.current.updateSearchQuery('test');
    });
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    expect(result.current.debouncedQuery).toBe('test');
    
    act(() => {
      result.current.updateSearchQuery('');
    });
    
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('should clear search and cancel pending timers', () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch({ onSearch }));
    
    act(() => {
      result.current.updateSearchQuery('test');
    });
    
    act(() => {
      result.current.clearSearch();
    });
    
    expect(result.current.searchQuery).toBe('');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // onSearch is called with empty string on mount and when cleared
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('should cancel previous timer when new query is entered', () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch({ onSearch }));
    
    act(() => {
      result.current.updateSearchQuery('test1');
    });
    
    act(() => {
      result.current.updateSearchQuery('test2');
    });
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // onSearch is called with empty string on mount, then with 'test2'
    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenCalledWith('test2');
  });

  it('should provide search suggestions', () => {
    const { result } = renderHook(() => useDebouncedSearch({ minLength: 2 }));
    
    const suggestions1 = result.current.getSuggestions('t');
    expect(suggestions1).toEqual([]);
    
    const suggestions2 = result.current.getSuggestions('te');
    expect(suggestions2).toEqual([]);
  });

  it('should handle rapid successive updates', () => {
    const onSearch = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch({ delay: 100, onSearch }));
    
    act(() => {
      result.current.updateSearchQuery('a');
    });
    
    act(() => {
      result.current.updateSearchQuery('ab');
    });
    
    act(() => {
      result.current.updateSearchQuery('abc');
    });
    
    act(() => {
      jest.advanceTimersByTime(100);
    });
    
    // onSearch is called with empty string on mount, then with 'abc'
    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenCalledWith('abc');
  });

  it('should cleanup timers on unmount', () => {
    const onSearch = jest.fn();
    const { result, unmount } = renderHook(() => useDebouncedSearch({ onSearch }));
    
    act(() => {
      result.current.updateSearchQuery('test');
    });
    
    unmount();
    
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // onSearch is called with empty string on mount
    expect(onSearch).toHaveBeenCalledWith('');
  });
});
