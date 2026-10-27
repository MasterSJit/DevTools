'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  // Position motion values
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Smooth springs to eliminate lag
  const springX = useSpring(cursorX, { stiffness: 600, damping: 35, mass: 0.4 });
  const springY = useSpring(cursorY, { stiffness: 600, damping: 35, mass: 0.4 });

  useEffect(() => {
    // 1. Mouse move tracker
    const handleMouseMove = (e) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    // 2. Global click feedback
    const handleMouseDown = () => {
      setIsClicking(true);
    };
    const handleMouseUp = () => {
      setIsClicking(false);
    };

    // 3. Global hover delegation
    const handleMouseOver = (e) => {
      const target = e.target.closest('.interactive, button, a, select, [role="button"], input[type="range"]');
      if (target) {
        setIsHovering(true);
      }
    };
    const handleMouseOut = (e) => {
      const target = e.target.closest('.interactive, button, a, select, [role="button"], input[type="range"]');
      if (target) {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mouseout', handleMouseOut);

    // Set cursor none globally on layout load
    document.documentElement.classList.add('custom-cursor-active');

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', handleMouseOut);
      document.documentElement.classList.remove('custom-cursor-active');
    };
  }, [cursorX, cursorY]);

  // Adjust cursor offset depending on state
  const size = isHovering ? 64 : 16;
  const offset = size / 2;

  return (
    <motion.div
      style={{
        left: springX,
        top: springY,
        translateX: -offset,
        translateY: -offset,
        width: size,
        height: size,
      }}
      className="fixed rounded-full pointer-events-none z-[9999] mix-blend-difference bg-white"
      animate={{
        scale: isClicking ? 0.8 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
    />
  );
}
