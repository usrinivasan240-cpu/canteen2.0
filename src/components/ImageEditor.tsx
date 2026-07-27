import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Crop, RotateCw, Square, Circle, RectangleHorizontal, ZoomIn, ZoomOut, Check, Upload, Move } from 'lucide-react';

interface ImageEditorProps {
  initialImage?: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  aspectRatio?: 'free' | '1:1' | '16:9' | '4:3' | '3:4';
  shape?: 'square' | 'circle' | 'rounded';
  maxWidth?: number;
  maxHeight?: number;
  title?: string;
}

type AspectRatio = 'free' | '1:1' | '16:9' | '4:3' | '3:4';
type Shape = 'square' | 'circle' | 'rounded';

const ASPECT_RATIOS: { label: string; value: AspectRatio; icon: React.ReactNode }[] = [
  { label: 'Free', value: 'free', icon: <Crop className="h-3 w-3" /> },
  { label: '1:1', value: '1:1', icon: <Square className="h-3 w-3" /> },
  { label: '16:9', value: '16:9', icon: <RectangleHorizontal className="h-3 w-3" /> },
  { label: '4:3', value: '4:3', icon: <RectangleHorizontal className="h-3 w-3" /> },
  { label: '3:4', value: '3:4', icon: <RectangleHorizontal className="h-3 w-3 rotate-90" /> },
];

const SHAPES: { label: string; value: Shape; icon: React.ReactNode }[] = [
  { label: 'Square', value: 'square', icon: <Square className="h-3 w-3" /> },
  { label: 'Circle', value: 'circle', icon: <Circle className="h-3 w-3" /> },
  { label: 'Rounded', value: 'rounded', icon: <RectangleHorizontal className="h-3 w-3" /> },
];

export default function ImageEditor({
  initialImage,
  onSave,
  onCancel,
  aspectRatio: defaultAspect = 'free',
  shape: defaultShape = 'square',
  maxWidth = 800,
  maxHeight = 600,
  title = 'Edit Image',
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string>(initialImage || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultAspect);
  const [shape, setShape] = useState<Shape>(defaultShape);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [cropDragType, setCropDragType] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);

  const canvasW = 600;
  const canvasH = 400;

  const getAspectValue = useCallback((ar: AspectRatio): number | null => {
    switch (ar) {
      case '1:1': return 1;
      case '16:9': return 16 / 9;
      case '4:3': return 4 / 3;
      case '3:4': return 3 / 4;
      default: return null;
    }
  }, []);

  const loadImage = useCallback((url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setImageUrl(url);
      const arVal = getAspectValue(aspectRatio);
      let cw = img.width;
      let ch = img.height;
      if (arVal) {
        if (cw / ch > arVal) {
          cw = ch * arVal;
        } else {
          ch = cw / arVal;
        }
      }
      const scale = Math.min(canvasW / cw, canvasH / ch, 1);
      const fw = cw * scale;
      const fh = ch * scale;
      setCropBox({
        x: (canvasW - fw) / 2,
        y: (canvasH - fh) / 2,
        w: fw,
        h: fh,
      });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setRotation(0);
    };
    img.src = url;
  }, [aspectRatio, getAspectValue]);

  useEffect(() => {
    if (imageUrl) loadImage(imageUrl);
  }, []);

  useEffect(() => {
    if (!image) return;
    const arVal = getAspectValue(aspectRatio);
    let cw = image.width;
    let ch = image.height;
    if (arVal) {
      if (cw / ch > arVal) {
        cw = ch * arVal;
      } else {
        ch = cw / arVal;
      }
    }
    const scale = Math.min(canvasW / cw, canvasH / ch, 1);
    const fw = cw * scale;
    const fh = ch * scale;
    setCropBox({
      x: (canvasW - fw) / 2,
      y: (canvasH - fh) / 2,
      w: fw,
      h: fh,
    });
  }, [aspectRatio, image, getAspectValue]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.save();

    ctx.translate(canvasW / 2 + offset.x, canvasH / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const scale = Math.min(canvasW / image.width, canvasH / image.height, 1);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.globalCompositeOperation = 'destination-out';
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(cropBox.x + cropBox.w / 2, cropBox.y + cropBox.h / 2, cropBox.w / 2, cropBox.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'rounded') {
      const r = 20;
      ctx.beginPath();
      ctx.roundRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h, r);
      ctx.fill();
    } else {
      ctx.fillRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(cropBox.x + cropBox.w / 2, cropBox.y + cropBox.h / 2, cropBox.w / 2, cropBox.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'rounded') {
      ctx.beginPath();
      ctx.roundRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h, 20);
      ctx.stroke();
    } else {
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
    }

    const handles = [
      { x: cropBox.x, y: cropBox.y },
      { x: cropBox.x + cropBox.w, y: cropBox.y },
      { x: cropBox.x, y: cropBox.y + cropBox.h },
      { x: cropBox.x + cropBox.w, y: cropBox.y + cropBox.h },
    ];
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    handles.forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.restore();
  }, [image, cropBox, zoom, offset, rotation, shape]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => loadImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const getCanvasCoords = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasW,
      y: ((e.clientY - rect.top) / rect.height) * canvasH,
    };
  };

  const isInsideCrop = (mx: number, my: number): boolean => {
    return mx >= cropBox.x && mx <= cropBox.x + cropBox.w && my >= cropBox.y && my <= cropBox.y + cropBox.h;
  };

  const getHandle = (mx: number, my: number): 'nw' | 'ne' | 'sw' | 'se' | 'move' | null => {
    const hs = 10;
    const { x, y, w, h } = cropBox;
    if (Math.abs(mx - x) < hs && Math.abs(my - y) < hs) return 'nw';
    if (Math.abs(mx - (x + w)) < hs && Math.abs(my - y) < hs) return 'ne';
    if (Math.abs(mx - x) < hs && Math.abs(my - (y + h)) < hs) return 'sw';
    if (Math.abs(mx - (x + w)) < hs && Math.abs(my - (y + h)) < hs) return 'se';
    if (isInsideCrop(mx, my)) return 'move';
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image) return;
    const { x, y } = getCanvasCoords(e);
    const handle = getHandle(x, y);
    if (handle) {
      setIsDraggingCrop(true);
      setCropDragType(handle);
      setDragStart({ x, y });
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!image) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoords(e);
    const handle = getHandle(x, y);
    if (handle === 'move') canvas.style.cursor = 'move';
    else if (handle) canvas.style.cursor = 'nwse-resize';
    else canvas.style.cursor = 'default';

    if (isDraggingCrop && cropDragType) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;
      setCropBox(prev => {
        let { x: cx, y: cy, w: cw, h: ch } = prev;
        const minSize = 30;
        const arVal = getAspectValue(aspectRatio);

        if (cropDragType === 'move') {
          cx += dx;
          cy += dy;
          cx = Math.max(0, Math.min(canvasW - cw, cx));
          cy = Math.max(0, Math.min(canvasH - ch, cy));
        } else {
          if (cropDragType.includes('e')) {
            cw = Math.max(minSize, Math.min(canvasW - cx, cw + dx));
          }
          if (cropDragType.includes('w')) {
            const newX = cx + dx;
            cw = Math.max(minSize, cw - dx);
            cx = prev.x + prev.w - cw;
          }
          if (cropDragType.includes('s')) {
            ch = Math.max(minSize, Math.min(canvasH - cy, ch + dy));
          }
          if (cropDragType.includes('n')) {
            const newY = cy + dy;
            ch = Math.max(minSize, ch - dy);
            cy = prev.y + prev.h - ch;
          }

          if (arVal) {
            if (cropDragType === 'se' || cropDragType === 'ne') {
              ch = cw / arVal;
            } else {
              cw = ch * arVal;
            }
          }
        }
        return { x: cx, y: cy, w: cw, h: ch };
      });
      setDragStart({ x, y });
    } else if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDraggingCrop(false);
    setCropDragType(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const exportCanvas = document.createElement('canvas');
    const outW = maxWidth;
    const outH = maxHeight;
    exportCanvas.width = outW;
    exportCanvas.height = outH;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, outW, outH);

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(outW / 2, outH / 2, outW / 2, outH / 2, 0, 0, Math.PI * 2);
      ctx.clip();
    } else if (shape === 'rounded') {
      const r = 30;
      ctx.beginPath();
      ctx.roundRect(0, 0, outW, outH, r);
      ctx.clip();
    }

    const scaleX = outW / cropBox.w;
    const scaleY = outH / cropBox.h;
    const srcX = (cropBox.x - (canvasW / 2 + offset.x - canvasW / 2)) / zoom;
    const srcY = (cropBox.y - (canvasH / 2 + offset.y - canvasH / 2)) / zoom;
    const srcW = cropBox.w / zoom;
    const srcH = cropBox.h / zoom;

    const imgScale = Math.min(canvasW / image.width, canvasH / image.height, 1);
    const drawW = image.width * imgScale;
    const drawH = image.height * imgScale;
    const imgOffX = (canvasW - drawW) / 2;
    const imgOffY = (canvasH - drawH) / 2;

    const sx = (srcX - imgOffX) / imgScale;
    const sy = (srcY - imgOffY) / imgScale;
    const sw = srcW / imgScale;
    const sh = srcH / imgScale;

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(image, sx, sy, sw, sh, -outW / 2, -outH / 2, outW, outH);
    ctx.restore();

    const dataUrl = exportCanvas.toDataURL('image/png', 0.92);
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-display font-bold text-sm text-gray-900">{title}</h3>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!imageUrl && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition"
            >
              <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-500">Click to upload image</p>
              <p className="text-[11px] text-gray-400 mt-1">PNG, JPG up to 10MB</p>
            </div>
          )}

          {imageUrl && (
            <>
              <div ref={containerRef} className="relative bg-gray-900 rounded-2xl overflow-hidden" style={{ aspectRatio: '3/2' }}>
                <canvas
                  ref={canvasRef}
                  width={canvasW}
                  height={canvasH}
                  className="w-full h-full"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-1">
                  {ASPECT_RATIOS.map(ar => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                        aspectRatio === ar.value ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {ar.icon}
                      {ar.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-1">
                  {SHAPES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setShape(s.value)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                        shape === s.value ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {s.icon}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
                  <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                    <ZoomOut className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <span className="text-[10px] font-mono text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                    <ZoomIn className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
                  <button onClick={() => setRotation(r => (r - 90) % 360)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                    <RotateCw className="h-3.5 w-3.5 text-gray-500 -scale-x-100" />
                  </button>
                  <span className="text-[10px] font-mono text-gray-500 w-10 text-center">{rotation}°</span>
                  <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                    <RotateCw className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-[10px] font-bold text-gray-600 transition"
                >
                  <Upload className="h-3 w-3" />
                  Replace
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <Move className="h-3 w-3" />
                Drag image to pan · Drag corners to crop · Use scroll to zoom
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!imageUrl}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-[11px] font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Save Image
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
    </div>
  );
}
