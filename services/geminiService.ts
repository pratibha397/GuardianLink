
import { Blob, FunctionDeclaration, GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const triggerAlertFunc: FunctionDeclaration = {
  name: 'triggerSOS',
  parameters: {
    type: Type.OBJECT,
    description: 'Call this if the user says the emergency phrase or sounds in immediate distress.',
    properties: { phrase: { type: Type.STRING } },
    required: ['phrase']
  }
};

const triggerFakeCallFunc: FunctionDeclaration = {
  name: 'triggerFakeCall',
  parameters: {
    type: Type.OBJECT,
    description: 'Call this if the user asks to be called or wants an excuse to leave.',
    properties: { delaySeconds: { type: Type.NUMBER } }
  }
};

interface MonitorOptions {
  triggerPhrase: string;
  onAlert: (p: string) => void;
  onFakeCall: () => void;
  onError: () => void;
}

export class GeminiVoiceMonitor {
  private sessionPromise: Promise<any> | null = null;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;

  constructor(private options: MonitorOptions) {}

  async start() {
    try {
      if (!process.env.API_KEY) throw new Error('API Key Required');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      this.ctx = new AudioContext({ sampleRate: 16000 });
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => this.startStreaming(),
          onmessage: async (msg: LiveServerMessage) => {
            const calls = msg.toolCall?.functionCalls;
            if (calls) {
              for (const fc of calls) {
                if (fc.name === 'triggerSOS') this.options.onAlert((fc.args as any).phrase);
                if (fc.name === 'triggerFakeCall') this.options.onFakeCall();
                
                this.sessionPromise?.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                }));
              }
            }
          },
          onerror: () => this.options.onError()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [triggerAlertFunc, triggerFakeCallFunc] }],
          systemInstruction: `You are Aegis, a stealth safety AI. 
          1. Call triggerSOS if you hear "${this.options.triggerPhrase}" or clear distress.
          2. Call triggerFakeCall if the user says something like "Aegis, call me" or "I need a call".
          Stay silent. Do not speak back.`
        }
      });
    } catch (e) {
      console.error(e);
      this.options.onError();
    }
  }

  private startStreaming() {
    if (!this.ctx || !this.stream) return;
    const source = this.ctx.createMediaStreamSource(this.stream);
    const processor = this.ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(data.length);
      for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
      
      const blob: Blob = {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000'
      };
      this.sessionPromise?.then(s => s.sendRealtimeInput({ media: blob }));
    };
    source.connect(processor);
    processor.connect(this.ctx.destination);
  }

  async stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    await this.ctx?.close();
    this.sessionPromise?.then(s => s.close());
  }
}
