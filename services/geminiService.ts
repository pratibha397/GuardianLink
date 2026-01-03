
import { Blob, FunctionDeclaration, GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const triggerAlertFunction: FunctionDeclaration = {
  name: 'triggerEmergencyAlert',
  parameters: {
    type: Type.OBJECT,
    description: 'Call this function immediately when you detect the user saying the specific trigger phrase indicating danger.',
    properties: {
      detectedPhrase: {
        type: Type.STRING,
        description: 'The phrase that was detected which triggered the alert.'
      }
    },
    required: ['detectedPhrase']
  }
};

interface LiveSessionOptions {
  triggerPhrase: string;
  onAlert: (phrase: string) => void;
  onError: (error: string) => void;
}

export class GeminiVoiceMonitor {
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isActive: boolean = false;

  constructor(private options: LiveSessionOptions) {}

  async start() {
    try {
      this.isActive = true;
      if (!process.env.API_KEY) throw new Error('API Key missing.');

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      this.inputAudioContext.onstatechange = () => {
        if (this.isActive && this.inputAudioContext?.state === 'suspended') {
          this.inputAudioContext?.resume();
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            this.setupMicrophone();
          },
          onmessage: async (message: LiveServerMessage) => {
            // FIX TS18048: Using optional chaining on toolCall
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls) {
              for (const fc of functionCalls) {
                if (fc.name === 'triggerEmergencyAlert') {
                  this.options.onAlert((fc.args as any).detectedPhrase);
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "Emergency verified. Link active." },
                      }
                    });
                  });
                }
              }
            }
          },
          onerror: (e: any) => {
            console.error('Monitor Error:', e);
            if (this.isActive) this.options.onError('Guardian AI connection lost.');
          },
          onclose: () => {
            console.log('Monitor session closed.');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [triggerAlertFunction] }],
          systemInstruction: `You are a SILENT safety engine. 
          NEVER speak. NEVER reply to conversations. 
          Your ONLY job is to monitor audio and call 'triggerEmergencyAlert' ONLY if you hear the phrase: "${this.options.triggerPhrase}". 
          Remain 100% silent at all times.`,
        }
      });
    } catch (err: any) {
      this.options.onError(err.message);
    }
  }

  private setupMicrophone() {
    if (!this.inputAudioContext || !this.stream) return;
    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    this.scriptProcessor.onaudioprocess = (event) => {
      if (this.inputAudioContext?.state === 'suspended') {
        this.inputAudioContext.resume();
      }

      const inputData = event.inputBuffer.getChannelData(0);
      const l = inputData.length;
      const int16 = new Int16Array(l);
      for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
      const pcmBlob: Blob = {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
      };
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };
    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  async stop() {
    this.isActive = false;
    if (this.scriptProcessor) this.scriptProcessor.disconnect();
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') await this.inputAudioContext.close();
    this.sessionPromise?.then(session => session.close());
    this.sessionPromise = null;
  }
}
