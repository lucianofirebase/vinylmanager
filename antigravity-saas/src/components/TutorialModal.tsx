'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Search, 
  Instagram, 
  Share2, 
  Sparkles 
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If true, the user is new and we update tutorialCompleted on finish
  isFirstTime?: boolean; 
}

const TUTORIAL_STEPS = [
  {
    id: 'add',
    title: 'Añadir Discos',
    description: 'Usa el buscador integrado para encontrar tu vinilo en Discogs y autocompletar la información, o añádelos manualmente en segundos.',
    icon: Search,
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 'instagram',
    title: 'Generador para Instagram',
    description: 'Selecciona un disco y crea automáticamente una publicación estética lista para compartir en tus historias o feed de Instagram.',
    icon: Instagram,
    color: 'from-pink-500 to-rose-500'
  },
  {
    id: 'showroom',
    title: 'Showroom Público',
    description: 'Cada disco tiene un enlace público único. Compártelo con tus clientes para que vean las fotos, escuchen el audio y te contacten por WhatsApp.',
    icon: Share2,
    color: 'from-emerald-500 to-teal-500'
  }
];

export default function TutorialModal({ isOpen, onClose, isFirstTime = false }: TutorialModalProps) {
  const { user, refreshUserData } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  if (!isOpen) return null;

  const handleNext = () => {
    setDirection(1);
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setDirection(-1);
    setStep((prev) => prev - 1);
  };

  const handleComplete = async () => {
    if (isFirstTime && user) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          tutorialCompleted: true
        }, { merge: true });
        await refreshUserData();
      } catch (err) {
        console.error('Error updating tutorial status', err);
      }
    }
    onClose();
    // reset state after close animation
    setTimeout(() => {
      setStep(0);
    }, 500);
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 100 : -100,
      opacity: 0
    })
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleComplete}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0 }}
        className="relative w-full max-w-md glass-card rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col min-h-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-white/5">
          <motion.div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: '0%' }}
            animate={{ width: `${((step + 1) / TUTORIAL_STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Close Button */}
        <button 
          onClick={handleComplete}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 relative flex flex-col pt-12 pb-6 px-8">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, cubicBezier: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col items-center text-center justify-center"
            >
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-tr ${TUTORIAL_STEPS[step].color} shadow-lg`}>
                {React.createElement(TUTORIAL_STEPS[step].icon, { className: "w-10 h-10 text-white" })}
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3">
                {TUTORIAL_STEPS[step].title}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {TUTORIAL_STEPS[step].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Footer */}
        <div className="p-6 border-t border-white/5 bg-slate-950/30 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-9" /> // placeholder
          )}

          <div className="flex gap-1.5">
            {TUTORIAL_STEPS.map((_, idx) => (
              <div 
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === step ? 'w-6 bg-indigo-400' : 'w-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>

          {step < TUTORIAL_STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              className="p-2 rounded-full hover:bg-white/5 text-indigo-400 hover:text-indigo-300 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="btn-premium py-1.5 px-4 text-xs font-bold flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Entendido
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
