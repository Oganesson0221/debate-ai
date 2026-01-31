import { useCallback, useEffect, useRef, useState } from "react";

// Speaker roles and their full names for announcements
const SPEAKER_NAMES: Record<string, string> = {
  pm: "Prime Minister",
  lo: "Leader of Opposition",
  dpm: "Deputy Prime Minister",
  dlo: "Deputy Leader of Opposition",
  gw: "Government Whip",
  ow: "Opposition Whip",
  pmr: "Prime Minister Reply",
  lor: "Leader of Opposition Reply",
};

// Speech times in seconds
const SPEECH_TIMES: Record<string, number> = {
  pm: 7 * 60,
  lo: 7 * 60,
  dpm: 7 * 60,
  dlo: 7 * 60,
  gw: 7 * 60,
  ow: 7 * 60,
  pmr: 4 * 60,
  lor: 4 * 60,
};

interface UseAIRefereeOptions {
  enabled?: boolean;
  voice?: string;
  rate?: number;
  pitch?: number;
}

interface RefereeState {
  isSpeaking: boolean;
  currentAnnouncement: string | null;
  voicesLoaded: boolean;
  selectedVoice: SpeechSynthesisVoice | null;
}

export function useAIReferee(options: UseAIRefereeOptions = {}) {
  const { enabled = true, rate = 0.9, pitch = 1.0 } = options;
  
  const [state, setState] = useState<RefereeState>({
    isSpeaking: false,
    currentAnnouncement: null,
    voicesLoaded: false,
    selectedVoice: null,
  });
  
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    synthRef.current = window.speechSynthesis;
    
    const loadVoices = () => {
      const voices = synthRef.current?.getVoices() || [];
      // Prefer a clear English voice
      const preferredVoice = voices.find(v => 
        v.lang.startsWith("en") && (
          v.name.includes("Google") || 
          v.name.includes("Microsoft") ||
          v.name.includes("Daniel") ||
          v.name.includes("Samantha")
        )
      ) || voices.find(v => v.lang.startsWith("en")) || voices[0];
      
      setState(prev => ({
        ...prev,
        voicesLoaded: true,
        selectedVoice: preferredVoice || null,
      }));
    };

    // Chrome loads voices asynchronously
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
    loadVoices();

    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  // Speak function
  const speak = useCallback((text: string, priority: boolean = false) => {
    if (!enabled || !synthRef.current) return;
    
    // Cancel current speech if priority
    if (priority && synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    
    // Wait for current speech to finish if not priority
    if (!priority && synthRef.current.speaking) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    
    if (state.selectedVoice) {
      utterance.voice = state.selectedVoice;
    }

    utterance.onstart = () => {
      setState(prev => ({ ...prev, isSpeaking: true, currentAnnouncement: text }));
    };

    utterance.onend = () => {
      setState(prev => ({ ...prev, isSpeaking: false, currentAnnouncement: null }));
    };

    utterance.onerror = () => {
      setState(prev => ({ ...prev, isSpeaking: false, currentAnnouncement: null }));
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [enabled, rate, pitch, state.selectedVoice]);

  // Stop speaking
  const stop = useCallback(() => {
    synthRef.current?.cancel();
    setState(prev => ({ ...prev, isSpeaking: false, currentAnnouncement: null }));
  }, []);

  // Pre-built announcements
  const announceDebateStart = useCallback((motionTitle: string) => {
    speak(`Welcome to this Asian Parliamentary debate. The motion before the house is: ${motionTitle}. We will now begin with the Prime Minister's speech.`, true);
  }, [speak]);

  const announceSpeaker = useCallback((speakerRole: string, speakerName?: string) => {
    const roleName = SPEAKER_NAMES[speakerRole] || speakerRole;
    const time = SPEECH_TIMES[speakerRole] || 7 * 60;
    const minutes = Math.floor(time / 60);
    
    const announcement = speakerName 
      ? `The floor now goes to ${speakerName}, speaking as ${roleName}. You have ${minutes} minutes.`
      : `The floor now goes to the ${roleName}. You have ${minutes} minutes.`;
    
    speak(announcement, true);
  }, [speak]);

  const announceTimeWarning = useCallback((secondsRemaining: number) => {
    if (secondsRemaining === 60) {
      speak("One minute remaining.");
    } else if (secondsRemaining === 30) {
      speak("Thirty seconds remaining.");
    } else if (secondsRemaining === 10) {
      speak("Ten seconds.");
    }
  }, [speak]);

  const announceProtectedTime = useCallback((isStart: boolean) => {
    if (isStart) {
      speak("Protected time has ended. Points of information may now be offered.");
    } else {
      speak("Protected time begins. No points of information.");
    }
  }, [speak]);

  const announcePOI = useCallback((accepted: boolean) => {
    if (accepted) {
      speak("Point of information accepted.");
    } else {
      speak("Point of information declined.");
    }
  }, [speak]);

  const announceSpeechEnd = useCallback((speakerRole: string) => {
    const roleName = SPEAKER_NAMES[speakerRole] || speakerRole;
    speak(`Thank you, ${roleName}. Your time has concluded.`, true);
  }, [speak]);

  const announceDebateEnd = useCallback((winner?: string) => {
    const announcement = winner 
      ? `This debate has concluded. The ${winner} team has won. Thank you to all participants.`
      : `This debate has concluded. Thank you to all participants. Feedback will now be generated.`;
    speak(announcement, true);
  }, [speak]);

  const announceRuleViolation = useCallback((violation: string) => {
    speak(`Rule violation detected: ${violation}`, true);
  }, [speak]);

  return {
    ...state,
    speak,
    stop,
    announceDebateStart,
    announceSpeaker,
    announceTimeWarning,
    announceProtectedTime,
    announcePOI,
    announceSpeechEnd,
    announceDebateEnd,
    announceRuleViolation,
  };
}
