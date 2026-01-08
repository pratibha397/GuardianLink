
import { AlertLog, AppSettings, User as AppUser, ChatMessage } from '../types';
import { getPreciseCurrentPosition } from './LocationService';
import { push, ref, rtdb, set } from './firebase';

/**
 * GuardianService: A singleton class that simulates a "Foreground Service".
 * It maintains the SpeechRecognition loop and SOS trigger logic 
 * even if the user navigates away from the Dashboard.
 */
class GuardianService {
  private static instance: GuardianService;
  private recognition: any = null;
  private isListening: boolean = false;
  private isTriggering: boolean = false;
  private user: AppUser | null = null;
  private settings: AppSettings | null = null;
  private statusCallback: ((status: string, heard: string) => void) | null = null;
  private alertCallback: ((log: AlertLog) => void) | null = null;

  private constructor() {}

  public static getInstance(): GuardianService {
    if (!GuardianService.instance) {
      GuardianService.instance = new GuardianService();
    }
    return GuardianService.instance;
  }

  public async start(
    user: AppUser, 
    settings: AppSettings, 
    onStatusUpdate: (status: string, heard: string) => void,
    onSOS: (log: AlertLog) => void
  ) {
    this.user = user;
    this.settings = settings;
    this.statusCallback = onStatusUpdate;
    this.alertCallback = onSOS;
    this.isListening = true;

    // Show persistent browser notification to simulate foreground status
    if (Notification.permission === 'granted') {
      new Notification("Aegis Guard Active", {
        body: "GuardianLink is monitoring for emergency triggers.",
        tag: "aegis-guard",
        silent: true
      });
    }

    this.startSpeechEngine();
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
    this.statusCallback?.('Stopped', '');
  }

  private startSpeechEngine() {
    if (!this.isListening || this.isTriggering) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.statusCallback?.('Engine Error', 'Browser not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.statusCallback?.('Listening...', '');
    };

    this.recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(' ')
        .toLowerCase();
      
      this.statusCallback?.('Listening...', transcript);

      const keywords = ['help', 'sos', 'emergency', 'danger', 'guardian help'];
      const trigger = this.settings?.triggerPhrase.toLowerCase().trim() || 'help me';
      const matched = keywords.some(k => transcript.includes(k)) || transcript.includes(trigger);
      
      if (matched && !this.isTriggering) {
        this.recognition.stop();
        this.triggerSOS(`Voice Detected: "${transcript}"`);
      }
    };

    this.recognition.onerror = (err: any) => {
      console.warn("Speech Engine Error:", err.error);
      if (err.error === 'not-allowed') {
        this.statusCallback?.('Engine Error', 'Mic Permission Required');
        this.isListening = false;
      }
    };

    this.recognition.onend = () => {
      // Loop forever while active
      if (this.isListening && !this.isTriggering) {
        try { this.recognition.start(); } catch {}
      } else {
        this.statusCallback?.('Stopped', '');
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error("Speech Startup Failed:", e);
    }
  }

  private async triggerSOS(reason: string) {
    if (!this.user || !this.settings || this.isTriggering) return;
    this.isTriggering = true;
    this.statusCallback?.('EMERGENCY', 'SOS TRIPPED');

    try {
      const loc = await getPreciseCurrentPosition();
      
      const guardians = this.settings.contacts || [];
      if (guardians.length === 0) return;

      const broadcastTasks = guardians.map(guardian => {
        const email1 = this.user!.email.toLowerCase().trim();
        const email2 = guardian.email.toLowerCase().trim();
        const sorted = [email1, email2].sort();
        const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
        const combinedId = `${sanitize(sorted[0])}__${sanitize(sorted[1])}`;
        const chatPath = `direct_chats/${combinedId}`;

        const sosMsg: ChatMessage = {
          id: `sos_auto_${Date.now()}_${guardian.id}`,
          type: 'location',
          senderName: this.user!.name,
          senderEmail: this.user!.email.toLowerCase().trim(),
          text: `🚨 EMERGENCY ALERT: Location [${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}] - ${reason} 🚨`,
          lat: loc.lat,
          lng: loc.lng,
          timestamp: Date.now()
        };

        return push(ref(rtdb, `${chatPath}/updates`), sosMsg);
      });

      await Promise.all(broadcastTasks);

      const alertId = `alert_${this.user.id}_${Date.now()}`;
      const log: AlertLog = {
        id: alertId, 
        senderEmail: this.user.email, 
        senderName: this.user.name,
        timestamp: Date.now(), 
        location: loc, 
        message: reason,
        isLive: true, 
        recipients: guardians.map(c => c.email)
      };
      await set(ref(rtdb, `alerts/${alertId}`), log);
      
      this.alertCallback?.(log);
    } catch (err: any) {
      console.error("Background SOS Fail:", err);
    } finally {
      this.isTriggering = false;
    }
  }
}

export default GuardianService.getInstance();
