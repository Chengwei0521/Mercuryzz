export class ObservatoryAudio {
  enabled = false;

  async toggle() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
      [65.41, 98, 130.81].forEach((frequency) => {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gain.gain.value = 0.055;
        oscillator.connect(gain).connect(this.master);
        oscillator.start();
      });
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    this.master.gain.setTargetAtTime(this.enabled ? 0.55 : 0, this.context.currentTime, 0.3);
    return this.enabled;
  }

  signal() {
    if (!this.enabled) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const time = this.context.currentTime + index * 0.12;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.14, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.3);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(time);
      oscillator.stop(time + 1.4);
    });
  }
}
