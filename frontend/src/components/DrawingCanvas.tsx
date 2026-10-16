import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Box, Button, Chip, Paper, Slider, Stack, ToggleButton, Tooltip } from '@mui/material';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useGame } from '../game/GameContext';
import type { CanvasEvent, Point } from '../game/messages';
import { displayFont, tokens } from '../theme';
import { EraserIcon } from './EraserIcon';

/**
 * Every client paints on the same logical 1000x625 (16:10) surface, scaled with CSS.
 * Strokes travel as normalised 0..1 coordinates, so any screen size
 * reconstructs exactly the same picture.
 */
const CANVAS_W = 1000;
const CANVAS_H = 625;
const BACKGROUND = '#FFFFFF';

// Backend limits (routers/websocket.py): <=200 points per message, width 1..50.
const MAX_POINTS_PER_MESSAGE = 200;
const BATCH_POINTS = 40;
const FLUSH_INTERVAL_MS = 45;
const MIN_WIDTH = 1;
const MAX_WIDTH = 50;
const MIN_STEP = 0.0008; // ignore sub-pixel jitter (normalised units)

const PALETTE = [
  '#241B4B',
  '#7A7595',
  '#FF5A5F',
  '#FF8A3D',
  '#FFC933',
  '#8BC34A',
  '#18C29C',
  '#2DB6F5',
  '#4B6BFF',
  '#6C4DFF',
  '#FF7AB8',
  '#8D5A3B',
] as const;

type Tool = 'brush' | 'eraser';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function paint(ctx: CanvasRenderingContext2D, event: CanvasEvent): void {
  if (event.kind === 'clear') {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    return;
  }

  const { points, color, width } = event;
  if (points.length === 0) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x * CANVAS_W, points[0].y * CANVAS_H, width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x * CANVAS_W, points[0].y * CANVAS_H);

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x * CANVAS_W, points[i].y * CANVAS_H);
  }

  ctx.stroke();
}

export function DrawingCanvas() {
  const { state, isDrawer, subscribeCanvas, sendStroke, sendClear } = useGame();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [size, setSize] = useState(8);

  // Handlers read the live style from a ref so they never use a stale value.
  const style = tool === 'eraser'
    ? { color: BACKGROUND, width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(size * 2.5))) }
    : { color, width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, size)) };
  const styleRef = useRef(style);
  styleRef.current = style;

  const stroke = useRef({
    active: false,
    pointerId: -1,
    pending: [] as Point[],
    dirty: false,
    timer: 0,
  });

  const drawerName = state.players.find((p) => p.id === state.drawerId)?.display_name ?? 'Someone';

  // ------------------------------------------------------- remote + replay

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctxRef.current = ctx;
    paint(ctx, { kind: 'clear' });

    // Also replays the round's strokes if this canvas was re-mounted.
    const unsubscribe = subscribeCanvas((event) => paint(ctx, event));

    return () => {
      unsubscribe();
      ctxRef.current = null;
    };
  }, [subscribeCanvas]);

  // ------------------------------------------------------------- sending

  const flush = useCallback(() => {
    const s = stroke.current;
    if (!s.dirty || s.pending.length === 0) return;

    const points = s.pending;
    const { color: strokeColor, width } = styleRef.current;

    // Stay under the server's per-message limit; chunks overlap by one
    // point so the receiver draws one continuous line.
    for (let start = 0; start < points.length; start += MAX_POINTS_PER_MESSAGE - 1) {
      const chunk = points.slice(start, start + MAX_POINTS_PER_MESSAGE);
      sendStroke(chunk, strokeColor, width);
      if (chunk.length < MAX_POINTS_PER_MESSAGE) break;
    }

    s.pending = [points[points.length - 1]];
    s.dirty = false;
  }, [sendStroke]);

  const endStroke = useCallback(() => {
    const s = stroke.current;
    if (!s.active) return;

    flush();
    window.clearInterval(s.timer);
    s.active = false;
    s.pointerId = -1;
    s.pending = [];
    s.dirty = false;
  }, [flush]);

  // Stop mid-stroke if we stop being the drawer, and on unmount.
  useEffect(() => {
    if (!isDrawer) endStroke();
    return () => endStroke();
  }, [isDrawer, endStroke]);

  const toPoint = (clientX: number, clientY: number): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();

    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !ctxRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const point = toPoint(e.clientX, e.clientY);
    const s = stroke.current;

    s.active = true;
    s.pointerId = e.pointerId;
    s.pending = [point];
    s.dirty = true;

    paint(ctxRef.current, { kind: 'draw', points: [point], ...styleRef.current });

    window.clearInterval(s.timer);
    s.timer = window.setInterval(flush, FLUSH_INTERVAL_MS);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = stroke.current;
    const ctx = ctxRef.current;
    if (!s.active || s.pointerId !== e.pointerId || !ctx) return;

    const native = e.nativeEvent;
    const samples =
      typeof native.getCoalescedEvents === 'function' && native.getCoalescedEvents().length > 0
        ? native.getCoalescedEvents()
        : [native];

    for (const sample of samples) {
      const point = toPoint(sample.clientX, sample.clientY);
      const previous = s.pending[s.pending.length - 1];

      if (Math.hypot(point.x - previous.x, point.y - previous.y) < MIN_STEP) continue;

      // Paint immediately for zero-latency feedback on the drawer's screen.
      paint(ctx, { kind: 'draw', points: [previous, point], ...styleRef.current });

      s.pending.push(point);
      s.dirty = true;
    }

    if (s.pending.length >= BATCH_POINTS) flush();
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (stroke.current.pointerId !== e.pointerId) return;

    endStroke();

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleClear = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    endStroke();
    paint(ctx, { kind: 'clear' });
    sendClear();
  };

  // ------------------------------------------------------------------ view

  const toolRail = (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        width: { xs: '100%', md: 176 },
        flexShrink: 0,
        order: { xs: 2, md: 0 }, // on phones the tools go under the canvas
        boxShadow: `4px 4px 0 ${tokens.ink}`,
      }}
    >
      <Stack spacing={1.75}>
        {/* tool */}
        <Stack direction={{ xs: 'row', md: 'column' }} spacing={1}>
          <ToggleButton
            value="brush"
            selected={tool === 'brush'}
            onChange={() => setTool('brush')}
            aria-label="Brush"
            sx={{ flex: 1, py: 0.75, borderRadius: 3 }}
          >
            <BrushRoundedIcon sx={{ mr: 0.75 }} /> Brush
          </ToggleButton>
          <ToggleButton
            value="eraser"
            selected={tool === 'eraser'}
            onChange={() => setTool('eraser')}
            aria-label="Eraser"
            sx={{ flex: 1, py: 0.75, borderRadius: 3 }}
          >
            <EraserIcon sx={{ mr: 0.75 }} /> Eraser
          </ToggleButton>
        </Stack>

        {/* colours */}
        <Box
          role="radiogroup"
          aria-label="Brush colour"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(6, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 1,
            opacity: tool === 'eraser' ? 0.4 : 1,
            transition: 'opacity .15s',
          }}
        >
          {PALETTE.map((swatch) => {
            const selected = swatch === color && tool === 'brush';

            return (
              <Box
                key={swatch}
                component="button"
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Colour ${swatch}`}
                onClick={() => {
                  setColor(swatch);
                  setTool('brush');
                }}
                sx={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  maxWidth: 34,
                  justifySelf: 'center',
                  p: 0,
                  cursor: 'pointer',
                  bgcolor: swatch,
                  borderRadius: '50%',
                  border: `3px solid ${tokens.ink}`,
                  boxShadow: selected ? `0 0 0 3px #fff, 0 0 0 6px ${tokens.violet}` : 'none',
                  transform: selected ? 'scale(1.1)' : 'none',
                  transition: 'transform .12s, box-shadow .12s',
                  '&:hover': { transform: 'scale(1.15)' },
                }}
              />
            );
          })}
        </Box>

        {/* size: its own full-width row so the slider is never squeezed */}
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.25 }}>
            <Box sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '.95rem' }}>Size</Box>
            <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center' }}>
              <Box
                sx={{
                  width: Math.min(34, style.width),
                  height: Math.min(34, style.width),
                  borderRadius: '50%',
                  bgcolor: tool === 'eraser' ? tokens.white : color,
                  border: `2.5px solid ${tokens.ink}`,
                }}
              />
            </Box>
          </Stack>
          <Box sx={{ px: 1 }}>
            <Slider
              min={2}
              max={36}
              value={size}
              onChange={(_, value) => setSize(value as number)}
              aria-label="Brush size"
              valueLabelDisplay="auto"
            />
          </Box>
        </Box>

        <Tooltip title="Wipe the canvas for everyone" arrow>
          <Button fullWidth variant="contained" color="secondary" startIcon={<DeleteSweepRoundedIcon />} onClick={handleClear}>
            Clear
          </Button>
        </Tooltip>
      </Stack>
    </Paper>
  );

  return (
    // Desktop: [tool panel | canvas] side by side. The canvas is as big as the
    // window height allows (300px = page header + round banner + margins; 1.6 =
    // 16:10 ratio), so nothing important is ever below the fold.
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { md: 'flex-start' },
        justifyContent: 'center',
        gap: 2,
        width: '100%',
      }}
    >
      {isDrawer && toolRail}

      <Box
        sx={{
          flex: 1,
          width: '100%',
          minWidth: 0,
          maxWidth: { xs: '100%', md: 'max(480px, calc((100vh - 300px) * 1.6))' },
          position: 'relative',
          overflow: 'hidden',
          bgcolor: BACKGROUND,
          border: `3px solid ${tokens.ink}`,
          borderRadius: 5,
          boxShadow: `6px 6px 0 ${isDrawer ? tokens.violet : tokens.ink}`,
          lineHeight: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          aria-label={isDrawer ? 'Drawing canvas' : `${drawerName}'s drawing`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            touchAction: 'none', // let touch draw instead of scroll the page
            cursor: isDrawer ? 'crosshair' : 'default',
            userSelect: 'none',
          }}
        />

        {!isDrawer && (
          <Chip
            icon={<VisibilityRoundedIcon />}
            label={`Watching ${drawerName} draw`}
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              lineHeight: 1.5,
              bgcolor: tokens.sunSoft,
              '& .MuiChip-icon': { color: tokens.ink },
            }}
          />
        )}
      </Box>
    </Box>
  );
}
