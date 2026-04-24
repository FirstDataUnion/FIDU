import {
  CHAT_AUTO_SCROLL_THRESHOLD_PX,
  computeTemporaryStreamBottomSpacerPx,
  getDistanceFromBottom,
  isNearBottom,
  resolveNextStreamScrollMode,
  STREAM_SPACER_MAX_PX,
  STREAM_SPACER_MIN_PX,
} from '../chatAutoScroll';

describe('chatAutoScroll', () => {
  describe('getDistanceFromBottom', () => {
    it('returns the remaining distance between viewport bottom and content bottom', () => {
      expect(
        getDistanceFromBottom({
          scrollHeight: 1200,
          scrollTop: 900,
          clientHeight: 250,
        })
      ).toBe(50);
    });
  });

  describe('isNearBottom', () => {
    it('is true at the default threshold boundary', () => {
      expect(
        isNearBottom({
          scrollHeight: 1000,
          scrollTop: 552,
          clientHeight: 400,
        })
      ).toBe(true);
    });

    it('is false when farther than the default threshold', () => {
      expect(
        isNearBottom({
          scrollHeight: 1000,
          scrollTop: 551,
          clientHeight: 400,
        })
      ).toBe(false);
    });

    it('supports custom thresholds', () => {
      expect(
        isNearBottom(
          {
            scrollHeight: 1000,
            scrollTop: 560,
            clientHeight: 400,
          },
          40
        )
      ).toBe(true);
      expect(CHAT_AUTO_SCROLL_THRESHOLD_PX).toBe(48);
    });
  });

  describe('computeTemporaryStreamBottomSpacerPx', () => {
    it('uses proportional spacer for typical heights', () => {
      expect(computeTemporaryStreamBottomSpacerPx(1000)).toBe(380);
    });

    it('clamps to minimum and maximum bounds', () => {
      expect(computeTemporaryStreamBottomSpacerPx(100)).toBe(
        STREAM_SPACER_MIN_PX
      );
      expect(computeTemporaryStreamBottomSpacerPx(2000)).toBe(
        STREAM_SPACER_MAX_PX
      );
    });
  });

  describe('resolveNextStreamScrollMode', () => {
    it('switches from bottom to anchored once bottom would hide assistant top', () => {
      expect(resolveNextStreamScrollMode('bottom', 900, 700)).toBe('anchored');
    });

    it('keeps bottom mode while assistant top remains visible', () => {
      expect(resolveNextStreamScrollMode('bottom', 600, 700)).toBe('bottom');
    });

    it('leaves non-bottom modes unchanged', () => {
      expect(resolveNextStreamScrollMode('anchored', 900, 700)).toBe(
        'anchored'
      );
      expect(resolveNextStreamScrollMode('none', 900, 700)).toBe('none');
    });
  });
});
