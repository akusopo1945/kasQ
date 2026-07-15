import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export default function VoiceButton({ onResult, onError }) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Tekan untuk bicara');
  const webRecognitionRef = useRef(null);

  // Trigger browser or native haptic feedback
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  useEffect(() => {
    // Setup Web Speech API fallback if not running on native Android/iOS
    if (!Capacitor.isNativePlatform()) {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.lang = 'id-ID';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
          setIsListening(true);
          setStatus('Mendengarkan...');
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          onResult(transcript);
        };

        recognition.onerror = (event) => {
          console.error('Web Speech Error:', event.error);
          onError(event.error);
          setIsListening(false);
          setStatus('Tekan untuk bicara');
        };

        recognition.onend = () => {
          setIsListening(false);
          setStatus('Tekan untuk bicara');
        };

        webRecognitionRef.current = recognition;
      }
    }

    return () => {
      // Cleanup Capacitor listeners if native
      if (Capacitor.isNativePlatform()) {
        SpeechRecognition.removeAllListeners();
      }
    };
  }, [onResult, onError]);

  const toggleListening = async () => {
    triggerHaptic();

    if (Capacitor.isNativePlatform()) {
      // Native Capacitor Speech Recognition Flow
      try {
        const { available } = await SpeechRecognition.available();
        if (!available) {
          onError('Speech recognition tidak tersedia di perangkat ini');
          return;
        }

        // Check permissions using modern v7 API
        let perm = await SpeechRecognition.checkPermissions();
        if (perm.speechRecognition !== 'granted' || perm.microphone !== 'granted') {
          perm = await SpeechRecognition.requestPermissions();
        }

        if (perm.speechRecognition !== 'granted' || perm.microphone !== 'granted') {
          onError('Izin mikrofon/speech recognition ditolak');
          return;
        }

        if (isListening) {
          await SpeechRecognition.stop();
          setIsListening(false);
          setStatus('Tekan untuk bicara');
        } else {
          setIsListening(true);
          setStatus('Mendengarkan...');

          // Start speech recognition
          await SpeechRecognition.start({
            language: 'id-ID',
            maxResults: 1,
            prompt: 'Katakan perintah transaksi...',
            partialResults: false,
            popup: true
          });

          // Register results listener
          SpeechRecognition.addListener('partialResults', (data) => {
            if (data.matches && data.matches.length > 0) {
              onResult(data.matches[0]);
              setIsListening(false);
              setStatus('Tekan untuk bicara');
            }
          });
        }
      } catch (err) {
        console.error('Capacitor Speech Error:', err);
        onError(err.message || 'Gagal merekam suara');
        setIsListening(false);
        setStatus('Tekan untuk bicara');
      }
    } else {
      // Browser Speech Recognition Flow
      if (!webRecognitionRef.current) {
        onError('Voice Input tidak didukung di browser ini. Gunakan Chrome/Edge.');
        return;
      }

      if (isListening) {
        webRecognitionRef.current.stop();
      } else {
        webRecognitionRef.current.start();
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      {/* Voice pulse button */}
      <button
        onClick={toggleListening}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 shadow-red-900/50 scale-110'
            : 'bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-950/40'
        }`}
      >
        {/* Pulsing ring */}
        {isListening && (
          <div className="absolute inset-0 rounded-full bg-red-500/35 animate-ping" />
        )}

        {/* Microphone Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-8 h-8 text-white z-10"
        >
          {isListening ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          )}
        </svg>
      </button>

      {/* Helper text */}
      <span className={`text-xs font-semibold tracking-wide transition-colors ${isListening ? 'text-red-400' : 'text-neutral-400'}`}>
        {status}
      </span>
    </div>
  );
}
