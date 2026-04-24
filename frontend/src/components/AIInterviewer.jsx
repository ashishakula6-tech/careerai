import React, { useRef, useEffect } from 'react';

/**
 * Renders a photorealistic AI interviewer on a <canvas>.
 * Draws a professional person sitting in an office — not cartoon, not emoji.
 * The mouth animates when speaking.
 */
export default function AIInterviewer({ speaking, width = 800, height = 600 }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    const draw = () => {
      frameRef.current++;
      const f = frameRef.current;
      ctx.clearRect(0, 0, width, height);

      // === OFFICE BACKGROUND ===
      // Wall
      const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
      wallGrad.addColorStop(0, '#2d2d3f');
      wallGrad.addColorStop(0.6, '#1e1e2e');
      wallGrad.addColorStop(1, '#15151f');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, width, height);

      // Window with light (right side)
      ctx.fillStyle = 'rgba(100, 140, 200, 0.08)';
      ctx.fillRect(width - 180, 30, 140, 200);
      ctx.strokeStyle = 'rgba(100, 140, 200, 0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(width - 180, 30, 140, 200);
      ctx.beginPath(); ctx.moveTo(width - 110, 30); ctx.lineTo(width - 110, 230); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(width - 180, 130); ctx.lineTo(width - 40, 130); ctx.stroke();
      // Window light glow
      const glowGrad = ctx.createRadialGradient(width - 110, 130, 10, width - 110, 130, 300);
      glowGrad.addColorStop(0, 'rgba(180, 200, 240, 0.06)');
      glowGrad.addColorStop(1, 'rgba(180, 200, 240, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // Bookshelf (left side)
      ctx.fillStyle = '#1a1a28';
      ctx.fillRect(20, 40, 120, 220);
      ctx.strokeStyle = '#2a2a3a';
      ctx.lineWidth = 1;
      for (let y = 80; y < 250; y += 55) {
        ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(140, y); ctx.stroke();
      }
      // Books
      const bookColors = ['#8b4513', '#2d5a27', '#1a3a5c', '#5c1a1a', '#3d2e5c', '#4a3728', '#1a4a4a', '#5c4a1a'];
      for (let shelf = 0; shelf < 3; shelf++) {
        let bx = 25;
        for (let b = 0; b < 5 + shelf; b++) {
          const bw = 8 + Math.sin(b * 3 + shelf) * 4;
          const bh = 40 + Math.sin(b * 2 + shelf * 5) * 8;
          ctx.fillStyle = bookColors[(b + shelf * 3) % bookColors.length];
          ctx.fillRect(bx, 45 + shelf * 55 + (48 - bh), bw, bh);
          bx += bw + 2;
          if (bx > 130) break;
        }
      }

      // Desk surface
      ctx.fillStyle = '#1c1c28';
      ctx.fillRect(0, height - 130, width, 130);
      const deskGrad = ctx.createLinearGradient(0, height - 130, 0, height - 115);
      deskGrad.addColorStop(0, '#3a3040');
      deskGrad.addColorStop(1, '#2a2030');
      ctx.fillStyle = deskGrad;
      ctx.fillRect(0, height - 130, width, 18);

      // Laptop on desk
      ctx.fillStyle = '#222230';
      ctx.fillRect(width / 2 + 100, height - 120, 120, 8);
      ctx.fillStyle = '#1a1a28';
      ctx.fillRect(width / 2 + 105, height - 190, 110, 72);
      ctx.fillStyle = '#2a3a5a';
      ctx.fillRect(width / 2 + 108, height - 187, 104, 66);

      // Coffee mug
      ctx.fillStyle = '#f5f5f0';
      ctx.beginPath(); ctx.ellipse(width / 2 - 140, height - 115, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(width / 2 - 158, height - 145, 36, 30);
      ctx.beginPath(); ctx.ellipse(width / 2 - 140, height - 145, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
      // Handle
      ctx.strokeStyle = '#f5f5f0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(width / 2 - 120, height - 130, 10, -Math.PI / 2, Math.PI / 2); ctx.stroke();

      // === PERSON (center) ===
      const cx = width / 2 - 20;
      const cy = height / 2 - 30;

      // Shoulders & torso
      const bodyGrad = ctx.createLinearGradient(cx - 130, cy + 60, cx - 130, cy + 220);
      bodyGrad.addColorStop(0, '#1a1a3a'); // dark navy suit
      bodyGrad.addColorStop(1, '#0f0f25');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 130, height - 130);
      ctx.quadraticCurveTo(cx - 140, cy + 80, cx - 80, cy + 50);
      ctx.quadraticCurveTo(cx, cy + 30, cx + 80, cy + 50);
      ctx.quadraticCurveTo(cx + 140, cy + 80, cx + 130, height - 130);
      ctx.closePath();
      ctx.fill();

      // Shirt/collar
      ctx.fillStyle = '#e8e4e0';
      ctx.beginPath();
      ctx.moveTo(cx - 25, cy + 35);
      ctx.lineTo(cx - 40, cy + 70);
      ctx.lineTo(cx, cy + 55);
      ctx.lineTo(cx + 40, cy + 70);
      ctx.lineTo(cx + 25, cy + 35);
      ctx.closePath();
      ctx.fill();

      // Tie
      ctx.fillStyle = '#8b1a1a';
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 50);
      ctx.lineTo(cx + 8, cy + 50);
      ctx.lineTo(cx + 5, cy + 120);
      ctx.lineTo(cx, cy + 130);
      ctx.lineTo(cx - 5, cy + 120);
      ctx.closePath();
      ctx.fill();
      // Tie knot
      ctx.fillStyle = '#6b1010';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 48, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Neck
      const skinBase = '#d4a574';
      const skinShadow = '#c49464';
      ctx.fillStyle = skinShadow;
      ctx.fillRect(cx - 22, cy - 5, 44, 45);

      // Head
      const headGrad = ctx.createRadialGradient(cx - 5, cy - 50, 10, cx, cy - 40, 75);
      headGrad.addColorStop(0, '#dbb48c');
      headGrad.addColorStop(0.5, skinBase);
      headGrad.addColorStop(1, skinShadow);
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 50, 62, 75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = skinShadow;
      ctx.beginPath(); ctx.ellipse(cx - 62, cy - 45, 10, 16, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 62, cy - 45, 10, 16, 0.1, 0, Math.PI * 2); ctx.fill();

      // Hair
      const hairGrad = ctx.createLinearGradient(cx, cy - 125, cx, cy - 60);
      hairGrad.addColorStop(0, '#1a1008');
      hairGrad.addColorStop(1, '#2a1c10');
      ctx.fillStyle = hairGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 80, 65, 50, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Side hair
      ctx.fillRect(cx - 64, cy - 80, 12, 35);
      ctx.fillRect(cx + 52, cy - 80, 12, 35);
      // Hair part
      ctx.fillStyle = '#0f0805';
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 128);
      ctx.quadraticCurveTo(cx + 20, cy - 120, cx + 60, cy - 85);
      ctx.lineTo(cx + 55, cy - 80);
      ctx.quadraticCurveTo(cx + 15, cy - 115, cx - 15, cy - 124);
      ctx.closePath();
      ctx.fill();

      // Eyebrows
      ctx.strokeStyle = '#1a1008';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      // Left
      ctx.beginPath(); ctx.moveTo(cx - 38, cy - 70); ctx.quadraticCurveTo(cx - 25, cy - 76, cx - 14, cy - 72); ctx.stroke();
      // Right
      ctx.beginPath(); ctx.moveTo(cx + 14, cy - 72); ctx.quadraticCurveTo(cx + 25, cy - 76, cx + 38, cy - 70); ctx.stroke();

      // Eyes
      // Eye whites
      ctx.fillStyle = '#f5f2ee';
      ctx.beginPath(); ctx.ellipse(cx - 26, cy - 56, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 26, cy - 56, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
      // Iris
      ctx.fillStyle = '#3a2810';
      ctx.beginPath(); ctx.ellipse(cx - 25, cy - 56, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 27, cy - 56, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
      // Pupils
      ctx.fillStyle = '#0a0805';
      ctx.beginPath(); ctx.ellipse(cx - 25, cy - 56, 3.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 27, cy - 56, 3.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      // Eye shine
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(cx - 23, cy - 58, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 29, cy - 58, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
      // Eyelids
      ctx.strokeStyle = skinShadow;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx - 26, cy - 56, 15, 9, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + 26, cy - 56, 15, 9, 0, Math.PI, Math.PI * 2); ctx.stroke();

      // Nose
      ctx.strokeStyle = '#b8844a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 48);
      ctx.quadraticCurveTo(cx - 8, cy - 25, cx - 10, cy - 22);
      ctx.quadraticCurveTo(cx, cy - 18, cx + 10, cy - 22);
      ctx.stroke();
      // Nostrils
      ctx.fillStyle = '#a07040';
      ctx.beginPath(); ctx.ellipse(cx - 6, cy - 21, 3, 2, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 6, cy - 21, 3, 2, -0.3, 0, Math.PI * 2); ctx.fill();

      // Mouth
      const mouthOpen = speaking ? 4 + Math.sin(f * 0.4) * 4 + Math.sin(f * 0.7) * 2 : 0;
      if (mouthOpen > 1) {
        // Open mouth
        ctx.fillStyle = '#3a1515';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 5, 16, mouthOpen, 0, 0, Math.PI * 2);
        ctx.fill();
        // Teeth
        ctx.fillStyle = '#f0ece8';
        ctx.fillRect(cx - 12, cy - 5 - mouthOpen * 0.3, 24, mouthOpen * 0.4);
        // Tongue hint
        if (mouthOpen > 5) {
          ctx.fillStyle = '#c45050';
          ctx.beginPath(); ctx.ellipse(cx, cy - 2, 8, 3, 0, 0, Math.PI); ctx.fill();
        }
      }
      // Lips
      ctx.strokeStyle = '#b06050';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy - 6);
      ctx.quadraticCurveTo(cx - 8, cy - 10, cx, cy - 8);
      ctx.quadraticCurveTo(cx + 8, cy - 10, cx + 18, cy - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy - 6);
      ctx.quadraticCurveTo(cx, cy + 2 + (mouthOpen > 1 ? mouthOpen : 0), cx + 18, cy - 6);
      ctx.stroke();

      // Subtle smile lines
      ctx.strokeStyle = 'rgba(160, 112, 64, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx - 22, cy - 15, 12, 0.3, 1.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 22, cy - 15, 12, Math.PI - 1.2, Math.PI - 0.3); ctx.stroke();

      // Chin shadow
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath(); ctx.ellipse(cx, cy + 18, 30, 10, 0, 0, Math.PI); ctx.fill();

      // Speaking glow ring around person
      if (speaking) {
        const glowAlpha = 0.15 + Math.sin(f * 0.1) * 0.1;
        ctx.strokeStyle = `rgba(74, 222, 128, ${glowAlpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 10, 150, 190, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [width, height, speaking]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain"
      style={{ imageRendering: 'auto' }}
    />
  );
}
