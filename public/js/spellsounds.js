(function () {
  var ctx = null, volume = 0.15;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function lumos() {
    if (!SpellSounds.enabled) return;
    var ac = getCtx(), t = ac.currentTime;
    var osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.35);
    var gain = ac.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(gain).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.45);
    // sparkle overlay
    var osc2 = ac.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1800, t);
    osc2.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    var g2 = ac.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(volume * 0.3, t + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(g2).connect(ac.destination);
    osc2.start(t); osc2.stop(t + 0.35);
  }

  function nox() {
    if (!SpellSounds.enabled) return;
    var ac = getCtx(), t = ac.currentTime;
    var osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    var gain = ac.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(gain).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.45);
  }

  function accio() {
    if (!SpellSounds.enabled) return;
    var ac = getCtx(), t = ac.currentTime;
    var buf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    var src = ac.createBufferSource();
    src.buffer = buf;
    var bp = ac.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
    var gain = ac.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume * 0.8, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(bp).connect(gain).connect(ac.destination);
    src.start(t); src.stop(t + 0.3);
  }

  function sparkle() {
    if (!SpellSounds.enabled) return;
    var ac = getCtx(), t = ac.currentTime, freq = 1200 + Math.random() * 800;
    var osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.08);
    var gain = ac.createGain();
    gain.gain.setValueAtTime(volume * 0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.15);
  }

  var SpellSounds = {
    enabled: true,
    lumos: lumos,
    nox: nox,
    accio: accio,
    sparkle: sparkle,
    setVolume: function (v) { volume = Math.max(0, Math.min(1, v)); },
  };
  window.SpellSounds = SpellSounds;
})();
