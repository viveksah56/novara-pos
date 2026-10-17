type ToneOptions = { frequency: number; volume: number; duration: number };

/** Short UI beep. Silently does nothing when the browser blocks audio before user interaction. */
export function playTone({ frequency, volume, duration }: ToneOptions) {
  try {
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => void context.close();
  } catch {
    /* Browser audio may require prior user interaction. */
  }
}
