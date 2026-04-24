import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { Message } from '../types';
import {
  computeTemporaryStreamBottomSpacerPx,
  isNearBottom,
  resolveNextStreamScrollMode,
  type StreamScrollMode,
} from '../utils/chatAutoScroll';

type UsePromptLabScrollBehaviorArgs = {
  messages: Message[];
  isLoading: boolean;
  currentConversationId?: string;
  isMobile: boolean;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
};

type UsePromptLabScrollBehaviorResult = {
  isAtBottom: boolean;
  showScrollToBottom: boolean;
  temporaryStreamBottomSpacerPx: number;
  handleScroll: () => void;
  handleJumpToLatest: () => void;
  setTemporaryStreamBottomSpacer: (enabled: boolean) => void;
  focusAssistantResponse: (
    assistantMessageId: string,
    options: { smooth: boolean; mode: StreamScrollMode }
  ) => void;
};

export function usePromptLabScrollBehavior({
  messages,
  isLoading,
  currentConversationId,
  isMobile,
  messagesContainerRef,
}: UsePromptLabScrollBehaviorArgs): UsePromptLabScrollBehaviorResult {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [temporaryStreamBottomSpacerPx, setTemporaryStreamBottomSpacerPx] =
    useState(0);

  const streamFollowAnimationFrameRef = useRef<number | null>(null);
  const openedConversationScrollRef = useRef<string | null>(null);
  const programmaticScrollLockUntilRef = useRef(0);
  const openConversationStartTimeoutRef = useRef<number | null>(null);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const streamScrollModeRef = useRef<StreamScrollMode>('none');
  const streamSpacerEnabledRef = useRef(false);

  const syncScrollState = useCallback(() => {
    const container = messagesContainerRef.current;
    const atBottom = container
      ? isNearBottom({
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
        })
      : false;
    setIsAtBottom(atBottom);
    setShowScrollToBottom(!atBottom);
  }, [messagesContainerRef]);

  const handleScroll = useCallback(() => {
    if (Date.now() < programmaticScrollLockUntilRef.current) {
      return;
    }
    streamScrollModeRef.current = 'none';
    syncScrollState();
  }, [syncScrollState]);

  const markProgrammaticScroll = useCallback((smooth: boolean) => {
    const now = Date.now();
    programmaticScrollLockUntilRef.current = Math.max(
      programmaticScrollLockUntilRef.current,
      now + (smooth ? 700 : 120)
    );
  }, []);

  const resolveScrollBehavior = useCallback(
    (smoothRequested: boolean): ScrollBehavior => {
      if (!smoothRequested) return 'auto';
      const prefersReducedMotion =
        typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      return prefersReducedMotion ? 'auto' : 'smooth';
    },
    []
  );

  const handleJumpToLatest = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const behavior = resolveScrollBehavior(true);
    markProgrammaticScroll(behavior === 'smooth');
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    setIsAtBottom(true);
    setShowScrollToBottom(false);
  }, [markProgrammaticScroll, messagesContainerRef, resolveScrollBehavior]);

  const jumpToLatestAfterLayout = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        handleJumpToLatest();
      });
    });
  }, [handleJumpToLatest]);

  const recomputeTemporaryStreamBottomSpacer = useCallback(() => {
    const container = messagesContainerRef.current;
    const viewportHeight =
      typeof window !== 'undefined'
        ? window.visualViewport?.height || window.innerHeight
        : 0;
    const basisHeight = container?.clientHeight || viewportHeight;
    if (!basisHeight) return;

    const base = computeTemporaryStreamBottomSpacerPx(basisHeight);
    const mobileAdjusted = isMobile ? Math.round(base * 0.9) : base;
    setTemporaryStreamBottomSpacerPx(mobileAdjusted);
  }, [isMobile, messagesContainerRef]);

  const setTemporaryStreamBottomSpacer = useCallback(
    (enabled: boolean) => {
      streamSpacerEnabledRef.current = enabled;
      if (!enabled) {
        setTemporaryStreamBottomSpacerPx(0);
        return;
      }
      recomputeTemporaryStreamBottomSpacer();
    },
    [recomputeTemporaryStreamBottomSpacer]
  );

  useEffect(() => {
    if (!streamSpacerEnabledRef.current) return;
    recomputeTemporaryStreamBottomSpacer();
  }, [isMobile, recomputeTemporaryStreamBottomSpacer]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleViewportResize = () => {
      if (!streamSpacerEnabledRef.current) return;
      recomputeTemporaryStreamBottomSpacer();
    };

    window.visualViewport?.addEventListener('resize', handleViewportResize);
    window.addEventListener('resize', handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener(
        'resize',
        handleViewportResize
      );
      window.removeEventListener('resize', handleViewportResize);
    };
  }, [recomputeTemporaryStreamBottomSpacer]);

  const scrollAssistantMessageIntoView = useCallback(
    (assistantMessageId: string, smooth: boolean) => {
      const container = messagesContainerRef.current;
      const messageElement = document.getElementById(
        `message-${assistantMessageId}`
      );
      if (!container || !messageElement) return false;
      const containerRect = container.getBoundingClientRect();
      const messageRect = messageElement.getBoundingClientRect();
      const targetTop = Math.max(
        0,
        container.scrollTop + (messageRect.top - containerRect.top) - 12
      );
      const behavior = resolveScrollBehavior(smooth);
      markProgrammaticScroll(behavior === 'smooth');
      container.scrollTo({
        top: targetTop,
        behavior,
      });
      setShowScrollToBottom(true);
      setIsAtBottom(false);
      return true;
    },
    [markProgrammaticScroll, messagesContainerRef, resolveScrollBehavior]
  );

  const focusAssistantResponse = useCallback(
    (
      assistantMessageId: string,
      options: { smooth: boolean; mode: StreamScrollMode }
    ) => {
      activeAssistantMessageIdRef.current = assistantMessageId;
      streamScrollModeRef.current = options.mode;

      if (options.mode === 'bottom') {
        jumpToLatestAfterLayout();
        return;
      }

      let attempts = 0;
      const maxAttempts = 8;
      const tryFocus = () => {
        const focused = scrollAssistantMessageIntoView(
          assistantMessageId,
          options.smooth && attempts === 0
        );
        if (focused || attempts >= maxAttempts) return;
        attempts += 1;
        window.setTimeout(tryFocus, 80);
      };
      tryFocus();
    },
    [jumpToLatestAfterLayout, scrollAssistantMessageIntoView]
  );

  useEffect(() => {
    const mode = streamScrollModeRef.current;
    if (mode === 'none' || !isLoading) return;
    const container = messagesContainerRef.current;
    const assistantId = activeAssistantMessageIdRef.current;
    if (!container || !assistantId) return;

    if (streamFollowAnimationFrameRef.current !== null) {
      cancelAnimationFrame(streamFollowAnimationFrameRef.current);
    }
    streamFollowAnimationFrameRef.current = requestAnimationFrame(() => {
      streamFollowAnimationFrameRef.current = null;
      const messageElement = document.getElementById(`message-${assistantId}`);
      if (!messageElement) return;

      const containerRect = container.getBoundingClientRect();
      const messageRect = messageElement.getBoundingClientRect();
      const assistantTop =
        container.scrollTop + (messageRect.top - containerRect.top) - 12;
      const desiredBottom = container.scrollHeight - container.clientHeight;
      const currentMode = streamScrollModeRef.current;

      if (currentMode === 'bottom') {
        const nextMode: StreamScrollMode = resolveNextStreamScrollMode(
          currentMode,
          desiredBottom,
          assistantTop
        );
        streamScrollModeRef.current = nextMode;
        if (nextMode === 'bottom') {
          const delta = desiredBottom - container.scrollTop;
          if (delta > 1) {
            const step = Math.min(12, Math.max(1, delta * 0.12));
            const easedBottom = Math.min(
              desiredBottom,
              container.scrollTop + step
            );
            markProgrammaticScroll(false);
            container.scrollTo({
              top: easedBottom,
              behavior: 'auto',
            });
          }
        }
      }

      if (streamScrollModeRef.current === 'anchored') {
        const clampedTarget = Math.min(
          desiredBottom,
          Math.max(0, assistantTop)
        );
        if (clampedTarget > container.scrollTop + 1) {
          const delta = clampedTarget - container.scrollTop;
          const step = Math.min(12, Math.max(1, delta * 0.12));
          const easedTop = Math.min(clampedTarget, container.scrollTop + step);
          markProgrammaticScroll(false);
          container.scrollTo({
            top: easedTop,
            behavior: 'auto',
          });
        }
      }

      if (streamScrollModeRef.current === 'anchored') {
        setShowScrollToBottom(true);
        setIsAtBottom(false);
      } else {
        const atBottom = isNearBottom({
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
        });
        setIsAtBottom(atBottom);
        setShowScrollToBottom(!atBottom);
      }
    });
  }, [messages, isLoading, markProgrammaticScroll, messagesContainerRef]);

  useEffect(() => {
    syncScrollState();
  }, [syncScrollState]);

  useEffect(() => {
    if (!currentConversationId || messages.length === 0) return;
    if (openedConversationScrollRef.current === currentConversationId) return;
    activeAssistantMessageIdRef.current = null;
    streamScrollModeRef.current = 'none';
    setTemporaryStreamBottomSpacer(false);

    const container = messagesContainerRef.current;
    if (container) {
      markProgrammaticScroll(false);
      container.scrollTo({
        top: 0,
        behavior: 'auto',
      });
    }
    setIsAtBottom(false);
    setShowScrollToBottom(true);

    const INITIAL_OPEN_SCROLL_DELAY_MS = 300;
    openConversationStartTimeoutRef.current = window.setTimeout(() => {
      handleJumpToLatest();
      openedConversationScrollRef.current = currentConversationId;
    }, INITIAL_OPEN_SCROLL_DELAY_MS);

    return () => {
      if (openConversationStartTimeoutRef.current !== null) {
        clearTimeout(openConversationStartTimeoutRef.current);
        openConversationStartTimeoutRef.current = null;
      }
    };
  }, [
    currentConversationId,
    messages.length,
    markProgrammaticScroll,
    handleJumpToLatest,
    setTemporaryStreamBottomSpacer,
    messagesContainerRef,
  ]);

  useEffect(() => {
    if (!currentConversationId) {
      openedConversationScrollRef.current = null;
    }
  }, [currentConversationId]);

  useEffect(
    () => () => {
      if (streamFollowAnimationFrameRef.current !== null) {
        cancelAnimationFrame(streamFollowAnimationFrameRef.current);
      }
      if (openConversationStartTimeoutRef.current !== null) {
        clearTimeout(openConversationStartTimeoutRef.current);
      }
    },
    []
  );

  return {
    isAtBottom,
    showScrollToBottom,
    temporaryStreamBottomSpacerPx,
    handleScroll,
    handleJumpToLatest,
    setTemporaryStreamBottomSpacer,
    focusAssistantResponse,
  };
}
