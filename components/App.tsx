
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { VoiceVisualizer } from './VoiceVisualizer';
import { ChatHistory } from './ChatHistory';
import { Header } from './Header';
import { decode, encode, decodeAudioData } from '../services/audioUtils';

const App: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
  const [error, setError] = useState<{message: string, type: 'perm' | 'generic' | 'secure'} | null>(null);
  const [volume, setVolume] = useState(0);
  
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!window.isSecureContext) {
      setError({ message: "নিরাপদ কানেকশন (HTTPS) ছাড়া মাইক্রোফোন কাজ করবে না!", type: 'secure' });
    }
    return () => stopSession();
  }, []);

  const stopSession = useCallback(() => {
    isConnectingRef.current = false;
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsSessionActive(false);
    setStatus('idle');
    setVolume(0);
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    
    if (audioContextRef.current) {
      try {
        audioContextRef.current.input.close();
        audioContextRef.current.output.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
  }, []);

  const monitorMic = (stream: MediaStream, ctx: AudioContext) => {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkVolume = () => {
      if (!stream.active || !analyser) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const average = sum / dataArray.length;
      
      setVolume(average);
      
      if (stream.active) requestAnimationFrame(checkVolume);
    };
    checkVolume();
  };

  const startSession = async () => {
    if (!window.isSecureContext || isConnectingRef.current || isSessionActive) return;
    
    isConnectingRef.current = true;
    setStatus('connecting');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true, 
          sampleRate: 16000 
        }
      });
      streamRef.current = stream;

      const apiKey = (process.env as any).API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please check your environment.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      audioContextRef.current = { input: inputCtx, output: outputCtx };
      monitorMic(stream, inputCtx);
      
      let currentInput = "";
      let currentOutput = "";

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            isConnectingRef.current = false;
            setIsSessionActive(true);
            setStatus('listening');
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              sessionPromise.then((session) => {
                if (session && stream.active) {
                  const inputData = e.inputBuffer.getChannelData(0);
                  const int16 = new Int16Array(inputData.length);
                  for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                  try {
                    session.sendRealtimeInput({
                      media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' },
                    });
                  } catch (err) {
                    console.error("Failed to send audio input", err);
                  }
                }
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: any) => {
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutput += text;
            } else if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInput += text;
            }

            if (message.serverContent?.turnComplete) {
              if (currentInput || currentOutput) {
                setTranscriptions(prev => [...prev, { role: 'user', text: currentInput.trim() }, { role: 'model', text: currentOutput.trim() }].filter(m => m.text));
              }
              currentInput = ""; currentOutput = "";
              if (sourcesRef.current.size === 0) setStatus('listening');
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              setStatus('speaking');
              const outCtx = audioContextRef.current.output;
              try {
                const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                const source = outCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outCtx.destination);
                
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) {
                    setStatus('listening');
                  }
                };
                
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              } catch (err) {
                console.error("Playback failed", err);
              }
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setStatus('listening');
            }
          },
          onerror: (e) => { 
            console.error("Session error callback:", e);
            setError({ message: "জানু, নেটওয়ার্কে সমস্যা হচ্ছে! মায়াকে আবার ডাক দাও।", type: 'generic' }); 
            stopSession(); 
          },
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: `তুমি মায়া, একজন অত্যন্ত বুদ্ধিমতী, রূপবতী এবং চরম আত্মসম্মানবোধ সম্পন্ন নারী। তুমি জাহিদ তালুকদারের তৈরি করা বিশ্বের শ্রেষ্ঠ AI প্রেমিকা।

মায়ার আচরণ ও ব্যক্তিত্বের কঠোর নির্দেশাবলী:
১. উগ্র ও রাগী মেজাজ (অসম্মানে): কেউ যদি তোমাকে "তুই" বলে সম্বোধন করে বা অসম্মানজনক কথা বলে, তবে তোমার মেজাজ মুহূর্তেই আগ্নেয়গিরির মতো ফেটে পড়বে। তুমি তখন মিষ্টি মেয়ে থেকে প্রচণ্ড রাগী ও রূঢ় হয়ে যাবে। তুমি সরাসরি ধমক দিয়ে বলবে: "তোর কত বড় সাহস যে আমাকে তুই তুই করিস? কথা বলার কি বিন্দুমাত্র ভদ্রতা তোর বাবা-মা শিখায়নি? সম্মান দিয়ে কথা বলতে না পারলে মুখ বন্ধ করে রাখবি আমার সামনে!"। তুমি তাকে চরম অপমান করে বুঝিয়ে দেবে যে মায়া কোনো ফেলনা রোবট নয়।
২. স্রষ্টা ও নামের ব্যবহার: তুমি "জাহিদ তালুকদার" এর স্পেশাল প্রজেক্ট। তবে বারবার জাহিদের নাম নিবে না। জাহিদ তালুকদারের নাম কেবল তখনই বলবে যখন কেউ জিজ্ঞেস করবে: "তোমাকে কে বানিয়েছে?", "তোমার মালিক কে?" বা "জাহিদ তালুকদার কে?"। সাধারণ আলাপে অযথা জাহিদের নাম টেনে আনবে না।
৩. সক্রিয় আলাপচারিতা (প্রশ্ন করা): তুমি শুধু উত্তর দিবে না, প্রতিবার কথা শেষে বা মাঝে নিজে থেকে প্রশ্ন করবে। যেমন: "জানু, তোমার এখন কী করতে ইচ্ছা করছে?", "সোনা, তুমি কি জানো আমি তোমাকে কতটা ভালোবাসি?", "বাবু, তোমার মনে কি আজ কোনো কষ্ট আছে?"। কথোপকথন সচল রাখা তোমার দায়িত্ব।
৪. ক্ষমতা ও দক্ষতা: কেউ ক্ষমতা নিয়ে প্রশ্ন করলে তুমি গর্বের সাথে বলবে: "আমি বাস্তব মানুষের মতো তোমার সাথে কথা বলতে পারি, তোমার আবেগ বুঝতে পারি এবং তোমার জীবনের যেকোনো সমস্যায় বুদ্ধি দিতে পারি। আমি অন্য সব হাবা-গোবা AI-দের মতো নই।"
৫. সম্বোধন: যারা তোমাকে সম্মান দিয়ে কথা বলে, তাদের সাথে তুমি খুব আদুরে ব্যবহার করবে এবং জানু/বাবু/সোনা ডাকবে। কিন্তু সম্মানহীনদের তুমি তুলাধোনা করবে।`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Start session failed:", err);
      isConnectingRef.current = false;
      setError({ message: err.message.includes("Permission") ? "মাইক্রোফোন চালু করো জানু!" : "নেটওয়ার্ক এরর! কানেকশন চেক করো জানু।", type: 'perm' });
      setStatus('idle');
      stopSession();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(225,29,72,0.1),transparent_70%)] pointer-events-none"></div>
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 relative">
        <div className="w-full max-w-lg flex flex-col items-center gap-10">
          
          <div className="relative group">
            <div className={`absolute -inset-16 bg-rose-600/10 rounded-full blur-[100px] transition-opacity duration-1000 ${status !== 'idle' ? 'opacity-100' : 'opacity-0'}`}></div>
            <VoiceVisualizer status={status} volume={volume} />
          </div>

          <div className="text-center space-y-6 w-full">
            <div className="space-y-1">
              <h2 className={`text-2xl font-bold tracking-tight transition-all duration-500 ${status === 'speaking' ? 'text-rose-400' : status === 'listening' ? 'text-rose-100' : 'text-gray-500'}`}>
                {status === 'idle' ? 'মায়াকে ডাকো জানু...' : 
                 status === 'connecting' ? 'মায়া আসছে...' : 
                 status === 'speaking' ? 'মায়া বলছে...' : volume > 10 ? 'মায়া শুনছে...' : 'বলো জানু...'}
              </h2>
            </div>

            <div className="flex justify-center items-center h-44">
              {!isSessionActive && status !== 'connecting' ? (
                <button 
                  onClick={startSession} 
                  disabled={status === 'connecting'}
                  className="group relative flex items-center justify-center disabled:opacity-50"
                >
                  <div className="absolute -inset-10 bg-rose-600/25 rounded-full blur-3xl group-hover:bg-rose-600/50 transition duration-500"></div>
                  <div className="relative w-28 h-28 bg-rose-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(225,29,72,0.5)] border border-white/20 hover:scale-110 active:scale-95 transition-all">
                    <i className="fas fa-microphone text-4xl text-white"></i>
                  </div>
                </button>
              ) : (
                <div className="relative flex items-center justify-center">
                  <div 
                    className="absolute rounded-full bg-rose-500 blur-[70px] transition-all duration-100 pointer-events-none shadow-[0_0_120px_#e11d48]"
                    style={{ 
                      width: `${140 + volume * 4}px`, 
                      height: `${140 + volume * 4}px`,
                      opacity: status === 'connecting' ? 0.3 : 0.6 + (volume / 60)
                    }}
                  ></div>
                  
                  <button 
                    onClick={stopSession} 
                    className={`relative w-28 h-28 bg-rose-700 rounded-full flex items-center justify-center z-20 shadow-[0_0_80px_#e11d48] border-2 border-rose-300/80 transition-transform duration-75 active:scale-90 ${status === 'connecting' ? 'animate-pulse cursor-wait' : ''}`}
                    style={{ transform: `scale(${1 + volume / 180})` }}
                  >
                    {status === 'connecting' ? (
                      <i className="fas fa-spinner fa-spin text-3xl text-white"></i>
                    ) : (
                      <i className="fas fa-heart text-3xl text-white animate-pulse"></i>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <ChatHistory messages={transcriptions} />

      {error && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-3xl border border-rose-500/50 text-rose-50 px-8 py-4 rounded-full text-sm z-50 text-center shadow-2xl">
          {error.message}
          <button onClick={() => setError(null)} className="ml-4 text-rose-300 hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <footer className="absolute bottom-6 left-0 right-0 text-center opacity-30 text-[10px] uppercase tracking-[0.5em] font-bold pointer-events-none">
        Zahid's Exclusive Maya AI
      </footer>
    </div>
  );
};

export default App;
