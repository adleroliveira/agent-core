export class SessionService {
  private static SESSION_KEY = 'agent_session_id';
  private sessionId: string | null = null;

  constructor() {
    this.initializeSession();
  }

  private initializeSession(): void {
    // Try to get existing session from localStorage
    const storedSession = localStorage.getItem(SessionService.SESSION_KEY);
    
    if (storedSession) {
      this.sessionId = storedSession;
    } else {
      // Generate new session ID
      this.sessionId = this.generateSessionId();
      localStorage.setItem(SessionService.SESSION_KEY, this.sessionId);
    }
  }

  private generateSessionId(): string {
    // Generate a UUID-like string
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  public getSessionId(): string {
    if (!this.sessionId) {
      this.initializeSession();
    }
    return this.sessionId!;
  }

  public resetSession(): void {
    this.sessionId = null;
    localStorage.removeItem(SessionService.SESSION_KEY);
    this.initializeSession();
  }
} 