
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

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const triggerAlertFunction: FunctionDeclaration = {
  name: 'triggerEmergencyAlert',
  parameters: {
    type: Type.OBJECT,
    description: 'Call this function immediately when you detect the user saying the specific trigger phrase.',
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
  private outputAudioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();

  constructor(private options: LiveSessionOptions) {}

  async start() {
    try {
      // Corrected: Always use process.env.API_KEY directly for initialization.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            this.setupMicrophone();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall?.functionCalls) {
                if (fc.name === 'triggerEmergencyAlert') {
                  // Fix: Explicitly cast unknown argument to string to match onAlert parameter type.
                  const detectedPhrase = (fc.args as any).detectedPhrase as string;
                  this.options.onAlert(detectedPhrase);
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "Emergency protocol initiated." },
                      }
                    });
                  });
                }
              }
            }

            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64EncodedAudioString && this.outputAudioContext && this.outputNode) {
              this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
              const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                this.outputAudioContext,
                24000,
                1,
              );
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode);
              source.addEventListener('ended', () => {
                this.sources.delete(source);
              });
              source.start(this.nextStartTime);
              this.nextStartTime = this.nextStartTime + audioBuffer.duration;
              this.sources.add(source);
            }

            if (message.serverContent?.interrupted) {
              for (const source of this.sources.values()) {
                source.stop();
                this.sources.delete(source);
              }
              this.nextStartTime = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Gemini Voice Monitor Error:', e);
            this.options.onError('Voice monitoring error. Please restart.');
          },
          onclose: () => {}
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [triggerAlertFunction] }],
          systemInstruction: `You are a real-time safety monitor. 
          LISTEN CONTINUOUSLY for the trigger phrase: "${this.options.triggerPhrase}". 
          When you hear "${this.options.triggerPhrase}" or anything very similar (like someone screaming it), 
          call triggerEmergencyAlert IMMEDIATELY. 
          Do not ask for confirmation. Do not talk back unless absolutely necessary to confirm safety. 
          Prioritize speed over everything else. Stay silent otherwise.`,
        }
      });
    } catch (err: any) {
      console.error('Failed to start Gemini monitor:', err);
      this.options.onError(err.message || 'Microphone access denied.');
    }
  }

  private setupMicrophone() {
    if (!this.inputAudioContext || !this.stream) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const l = inputData.length;
      const int16 = new Int16Array(l);
      for (let i = 0; i < l; i++) {
        int16[i] = inputData[i] * 32768;
      }
      
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
    if (this.scriptProcessor) this.scriptProcessor.disconnect();
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    
    this.sessionPromise?.then(session => session.close());
    this.sessionPromise = null;
    this.sources.clear();
    this.nextStartTime = 0;
  }
}
