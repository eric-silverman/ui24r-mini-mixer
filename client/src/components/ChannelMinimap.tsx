import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChannelState } from '../lib/types';

type Props = {
  channels: ChannelState[];
  scrollContainerRef: React.RefObject<HTMLDivElement>;
};

// Get 2-letter abbreviation for a channel
function getChannelAbbr(channel: ChannelState): string {
  const name = channel.name || channel.label || '';
  if (name.length === 0) {
    return String(channel.id).padStart(2, '0');
  }
  // Use first 2 characters, uppercase
  return name.slice(0, 2).toUpperCase();
}

export default function ChannelMinimap({ channels, scrollContainerRef }: Props) {
  const minimapRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollInfo, setScrollInfo] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });

  // Update scroll info when container scrolls
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateScrollInfo = () => {
      setScrollInfo({
        scrollLeft: container.scrollLeft,
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
      });
    };

    // Initial update
    updateScrollInfo();

    // Listen for scroll events
    container.addEventListener('scroll', updateScrollInfo, { passive: true });

    // Listen for resize to update dimensions
    const resizeObserver = new ResizeObserver(updateScrollInfo);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollInfo);
      resizeObserver.disconnect();
    };
  }, [scrollContainerRef]);

  // Scroll to position based on X coordinate in minimap
  const scrollToPosition = useCallback(
    (clientX: number, smooth = false) => {
      const container = scrollContainerRef.current;
      const minimap = minimapRef.current;
      if (!container || !minimap) return;

      const rect = minimap.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));

      // Calculate target scroll position (center the viewport on position)
      const maxScroll = container.scrollWidth - container.clientWidth;
      const targetScroll = clickRatio * container.scrollWidth - container.clientWidth / 2;

      container.scrollTo({
        left: Math.max(0, Math.min(maxScroll, targetScroll)),
        behavior: smooth ? 'smooth' : 'auto',
      });
    },
    [scrollContainerRef]
  );

  // Handle click on minimap track (not viewport) to scroll to position
  const handleMinimapClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Only handle clicks on track, not on viewport (viewport uses drag)
      if ((event.target as HTMLElement).classList.contains('minimap-viewport')) {
        return;
      }
      // Use instant scroll so viewport indicator moves immediately
      scrollToPosition(event.clientX, false);
    },
    [scrollToPosition]
  );

  // Handle drag start on viewport
  const handleViewportMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(true);
    },
    []
  );

  // Handle touch start on viewport
  const handleViewportTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      event.stopPropagation();
      setIsDragging(true);
    },
    []
  );

  // Handle drag move and end
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      scrollToPosition(event.clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        scrollToPosition(event.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, scrollToPosition]);

  // Don't render if no channels
  if (channels.length === 0) {
    return null;
  }

  // Check if scrolling is possible
  const canScroll = scrollInfo.scrollWidth > scrollInfo.clientWidth;

  // Calculate viewport indicator position and width
  const viewportRatio = scrollInfo.clientWidth / scrollInfo.scrollWidth;
  const viewportLeft = (scrollInfo.scrollLeft / scrollInfo.scrollWidth) * 100;
  const viewportWidth = viewportRatio * 100;

  return (
    <div
      className={`channel-minimap ${isDragging ? 'minimap-dragging' : ''}`}
      ref={minimapRef}
      onClick={handleMinimapClick}
    >
      <div className="minimap-track">
        {/* Render mini fader bars for each channel */}
        {channels.map((channel) => {
          const faderHeight = Math.max(5, channel.fader * 100);
          // Signal is clamped to fader height (can't exceed fader position)
          const signalHeight = Math.min(
            faderHeight,
            Math.max(0, (channel.meterPostFader ?? 0) * 100)
          );
          return (
            <div
              key={channel.id}
              className={`minimap-channel ${channel.muted ? 'minimap-channel-muted' : ''}`}
              title={channel.name || channel.label || `CH ${channel.id}`}
            >
              {/* Gray background showing fader position */}
              <div
                className="minimap-fader-bg"
                style={{ height: `${faderHeight}%` }}
              />
              {/* Colored signal overlay */}
              <div
                className="minimap-signal"
                style={{ height: `${signalHeight}%` }}
              />
              {/* Channel label */}
              <span className="minimap-label">{getChannelAbbr(channel)}</span>
            </div>
          );
        })}
      </div>
      {/* Viewport indicator - draggable */}
      {canScroll && (
        <div
          className={`minimap-viewport ${isDragging ? 'minimap-viewport-dragging' : ''}`}
          style={{
            left: `${viewportLeft}%`,
            width: `${viewportWidth}%`,
          }}
          onMouseDown={handleViewportMouseDown}
          onTouchStart={handleViewportTouchStart}
        />
      )}
    </div>
  );
}
