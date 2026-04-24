export const CHAT_AUTO_SCROLL_THRESHOLD_PX = 48;
export const STREAM_SPACER_RATIO = 0.38;
export const STREAM_SPACER_MIN_PX = 126;
export const STREAM_SPACER_MAX_PX = 380;

export type StreamScrollMode = 'none' | 'bottom' | 'anchored';

export type ScrollMetrics = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
};

export function getDistanceFromBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
}: ScrollMetrics): number {
  return scrollHeight - (scrollTop + clientHeight);
}

export function isNearBottom(
  metrics: ScrollMetrics,
  threshold = CHAT_AUTO_SCROLL_THRESHOLD_PX
): boolean {
  return getDistanceFromBottom(metrics) <= threshold;
}

export function computeTemporaryStreamBottomSpacerPx(
  clientHeight: number
): number {
  return Math.round(
    Math.min(
      STREAM_SPACER_MAX_PX,
      Math.max(STREAM_SPACER_MIN_PX, clientHeight * STREAM_SPACER_RATIO)
    )
  );
}

export function resolveNextStreamScrollMode(
  mode: StreamScrollMode,
  desiredBottom: number,
  assistantTop: number
): StreamScrollMode {
  if (mode !== 'bottom') return mode;
  return desiredBottom > assistantTop ? 'anchored' : 'bottom';
}
