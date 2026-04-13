(function () {
  var creatures = {
    stag: {
      w: 56, h: 40, speed: 7,
      paths: [
        // body — barrel chest, arched neck, legs in stride
        "M8 28 Q6 26 7 23 Q8 18 12 16 L16 14 Q20 12 24 12 L32 13 Q36 14 38 16 Q40 18 40 22 L42 28 Q42 30 40 30 L38 24 Q37 22 36 24 L34 30 M24 16 L22 22 Q21 24 20 28 L18 30 M22 22 Q23 24 24 28",
        // antlers — branching rack
        "M16 14 L14 8 L12 5 M14 8 L16 5 M16 14 L18 9 L17 5 M18 9 L20 6 M18 9 L21 8",
        // head
        "M12 16 Q10 15 9 16 Q8 17 9 18 Q10 18 12 17",
        // tail
        "M40 18 Q43 16 44 14"
      ]
    },
    owl: {
      w: 56, h: 36, speed: 6,
      paths: [
        // body — round, compact
        "M24 18 Q20 16 20 20 Q20 24 24 26 Q28 28 32 26 Q36 24 36 20 Q36 16 32 18 Z",
        // wings spread wide
        "M20 20 Q14 14 6 12 Q3 12 2 14 Q4 16 8 18 Q12 20 20 22 M36 20 Q42 14 50 12 Q53 12 54 14 Q52 16 48 18 Q44 20 36 22",
        // eyes and beak
        "M25 19 Q26 18 27 19 M30 19 Q31 18 32 19 M28 21 L29 22 L28 23",
        // ear tufts
        "M23 16 L21 12 M33 16 L35 12"
      ]
    },
    phoenix: {
      w: 60, h: 36, speed: 5.5,
      paths: [
        // body — sleek, elongated
        "M20 16 Q22 14 26 14 Q30 14 32 16 Q34 18 34 20 Q34 22 32 22 Q28 22 24 20 Q22 18 20 16 Z",
        // wings — swept back, dramatic
        "M22 16 Q16 10 8 6 Q5 5 4 7 Q6 10 10 14 Q14 17 22 18 M32 16 Q38 10 46 6 Q49 5 50 7 Q48 10 44 14 Q40 17 32 18",
        // long flowing tail feathers
        "M34 20 Q38 22 42 26 Q44 28 48 30 Q50 32 54 30 M34 21 Q37 24 40 28 Q42 30 46 32 Q48 34 52 34 M34 20 Q36 23 38 28 Q39 30 42 33",
        // head crest
        "M20 16 L18 12 Q17 10 18 9 M20 15 L17 11"
      ]
    },
    cat: {
      w: 52, h: 32, speed: 9,
      paths: [
        // body — sleek trot, arched back
        "M12 18 Q14 14 18 13 Q22 12 26 13 Q30 13 34 14 Q38 16 38 20 L40 26 M34 14 Q33 18 32 22 L30 26 M18 13 Q17 16 16 20 L14 26 M26 13 Q25 16 26 20 L28 26",
        // head
        "M10 16 Q8 14 8 12 Q8 10 10 10 Q12 8 14 10 Q14 12 14 14 Q13 16 12 18",
        // ears — pointed
        "M9 12 L7 6 L10 10 M13 10 L15 5 L14 10",
        // tail — high, curved
        "M38 18 Q42 14 44 10 Q45 8 46 8 Q47 9 46 12 Q45 14 44 16"
      ]
    },
    otter: {
      w: 56, h: 28, speed: 9.5,
      paths: [
        // body — long, sinuous, bounding
        "M8 16 Q10 12 14 11 Q18 10 22 11 Q26 11 30 12 Q34 12 36 14 Q38 16 38 18 L40 22 M30 12 Q29 16 28 20 L26 22 M22 11 Q21 14 20 18 L18 22 M14 11 Q13 14 12 18 L10 22",
        // head — round, whiskered
        "M6 14 Q4 12 4 10 Q4 8 6 8 Q8 8 9 10 Q9 12 8 14 Q7 16 6 16",
        // tail — thick, tapered
        "M38 16 Q42 14 46 14 Q50 14 52 16 Q53 17 52 18",
        // whiskers
        "M5 12 L2 10 M5 13 L2 13 M5 14 L2 16"
      ]
    },
    dog: {
      w: 56, h: 38, speed: 6.5,
      paths: [
        // body — large, powerful, running
        "M12 22 Q14 16 18 14 Q22 12 26 12 Q30 12 34 14 Q38 16 40 20 L42 28 Q42 30 40 30 L38 24 M34 14 Q33 18 32 22 L30 28 Q30 30 28 30 M18 14 Q17 18 16 22 L14 28 Q14 30 12 30 M26 12 Q25 16 24 20 L22 28 Q22 30 20 30",
        // head — blocky muzzle
        "M10 20 Q8 18 6 18 Q4 18 3 20 Q3 22 5 22 Q7 22 8 20 L10 20 Q12 18 14 18",
        // ears — floppy
        "M8 18 Q6 14 4 12 Q3 11 4 13 Q5 15 7 17 M12 16 Q12 12 10 10 Q9 9 10 12 Q10 14 12 16",
        // tail — long, flowing
        "M40 18 Q44 14 46 10 Q47 8 48 8 Q49 9 48 12"
      ]
    }
  };

  var names = Object.keys(creatures);
  var active = null;
  var timer = null;
  var stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var s = document.createElement("style");
    s.textContent = [
      ".magical-creature{position:fixed;z-index:1;pointer-events:none;color:rgba(192,210,235,0.12);filter:drop-shadow(0 0 6px rgba(192,210,235,0.15))}",
      "@keyframes creature-traverse{from{transform:translateX(var(--mc-from))}to{transform:translateX(var(--mc-to))}}",
      "@keyframes creature-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}",
      "@keyframes creature-gallop{0%,100%{transform:rotate(0deg) scaleY(1)}25%{transform:rotate(2deg) scaleY(0.95)}50%{transform:rotate(0deg) scaleY(1)}75%{transform:rotate(-2deg) scaleY(0.95)}}",
      "@keyframes creature-flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.85)}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn(name) {
    if (active) return;
    injectStyles();
    if (!name || !creatures[name]) name = pick(names);
    var c = creatures[name];
    var goLeft = Math.random() < 0.5;
    var yPct = rand(20, 80);
    var dur = c.speed + rand(-1, 1);
    var size = rand(40, 60);
    var scale = size / c.w;

    var wrap = document.createElement("div");
    wrap.className = "magical-creature";
    wrap.style.top = yPct + "vh";
    wrap.style.left = "0";
    wrap.style.width = size + "px";
    wrap.style.setProperty("--mc-from", goLeft ? "calc(100vw + 20px)" : (-size - 20) + "px");
    wrap.style.setProperty("--mc-to", goLeft ? (-size - 20) + "px" : "calc(100vw + 20px)");
    wrap.style.animation = "creature-traverse " + dur.toFixed(1) + "s linear forwards";

    var inner = document.createElement("div");
    inner.style.animation = "creature-bob 2s ease-in-out infinite";

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 " + c.w + " " + c.h);
    svg.setAttribute("width", size);
    svg.setAttribute("height", Math.round(c.h * scale));
    svg.style.display = "block";
    // Creatures face right by default; flip when going left
    // Also add gallop (ground) or flap (flying) animation
    var isFlying = name === "owl" || name === "phoenix";
    var motionAnim = isFlying ? "creature-flap 0.4s ease-in-out infinite" : "creature-gallop 0.3s ease-in-out infinite";
    if (goLeft) {
      svg.style.transform = "scaleX(-1)";
      svg.style.animation = motionAnim;
    } else {
      svg.style.animation = motionAnim;
    }

    c.paths.forEach(function (d) {
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "currentColor");
      p.setAttribute("stroke-width", "1.5");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      svg.appendChild(p);
    });

    inner.appendChild(svg);
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    active = wrap;

    wrap.addEventListener("animationend", function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      active = null;
    });
  }

  function scheduleNext() {
    if (!MagicalCreatures.enabled) return;
    timer = setTimeout(function () {
      spawn(pick(names));
      scheduleNext();
    }, rand(45000, 90000));
  }

  var MagicalCreatures = {
    enabled: true,
    start: function () {
      this.enabled = true;
      if (timer) clearTimeout(timer);
      scheduleNext();
    },
    stop: function () {
      this.enabled = false;
      if (timer) { clearTimeout(timer); timer = null; }
    },
    summon: function (name) {
      spawn(name || undefined);
    }
  };

  window.MagicalCreatures = MagicalCreatures;

  setTimeout(function () { MagicalCreatures.start(); }, 10000);
})();
