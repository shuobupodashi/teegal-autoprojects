import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTypewriterEffectOptions {
  text: string;
  speed?: number;
  enabled?: boolean;
  onComplete?: () => void;
  isComplete?: boolean;
}

interface UseTypewriterEffectReturn {
  displayedText: string;
  isTyping: boolean;
  isComplete: boolean;
}

export const useTypewriterEffect = ({
  text,
  speed = 30,
  enabled = true,
  onComplete,
  isComplete: externalIsComplete = false
}: UseTypewriterEffectOptions): UseTypewriterEffectReturn => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const indexRef = useRef(0);
  const completedTextRef = useRef<string>('');
  const wasHiddenRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const externalIsCompleteRef = useRef(externalIsComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    externalIsCompleteRef.current = externalIsComplete;
  }, [externalIsComplete]);

  const finishTyping = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDisplayedText(text);
    setIsTyping(false);
    setIsComplete(true);
    completedTextRef.current = text;
    onCompleteRef.current?.();
  }, [text]);

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText(text);
      setIsComplete(true);
      setIsTyping(false);
      completedTextRef.current = text;
      return;
    }

    if (completedTextRef.current === text) {
      setDisplayedText(text);
      setIsComplete(true);
      setIsTyping(false);
      return;
    }

    if (document.visibilityState === 'hidden') {
      setDisplayedText(text);
      setIsComplete(true);
      setIsTyping(false);
      completedTextRef.current = text;
      onCompleteRef.current?.();
      return;
    }

    setDisplayedText('');
    setIsComplete(false);
    setIsTyping(true);
    indexRef.current = 0;

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      const currentIndex = indexRef.current;
      
      if (currentIndex < text.length) {
        setDisplayedText(text.substring(0, currentIndex + 1));
        indexRef.current++;
      } else {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsTyping(false);
        setIsComplete(true);
        completedTextRef.current = text;
        onCompleteRef.current?.();
      }
    }, speed);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, speed, enabled]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
        if (isTyping && text) {
          finishTyping();
        }
      } else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        if ((externalIsCompleteRef.current || isTyping) && text) {
          finishTyping();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTyping, text, finishTyping]);

  useEffect(() => {
    if (externalIsComplete && isTyping && text) {
      finishTyping();
    }
  }, [externalIsComplete, isTyping, text, finishTyping]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return {
    displayedText,
    isTyping,
    isComplete
  };
};
