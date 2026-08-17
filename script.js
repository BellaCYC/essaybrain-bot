const phrases = [
    "a Discord bot.",
    "a Socratic essay coach.",
    "an AI brainstorming partner.",
    "a personal memory log."
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typeEffect() {
    const targetElement = document.getElementById("animated-text");
    if (!targetElement) return;

    const currentPhrase = phrases[phraseIndex];

    if (isDeleting) {
        targetElement.textContent = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
    } else {
        targetElement.textContent = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
    }

    let typingSpeed = isDeleting ? 40 : 80;

    if (!isDeleting && charIndex === currentPhrase.length) {
        typingSpeed = 2000; // Pause at full word
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typingSpeed = 400; // Pause before typing next word
    }

    setTimeout(typeEffect, typingSpeed);
}

document.addEventListener("DOMContentLoaded", typeEffect);

// --- Mascot animation ---
const mascotWrap = document.getElementById("mascot-wrap");
const mascotFlip = document.getElementById("mascot-flip");
const mascot = document.getElementById("mascot");
const eyeLeft = document.getElementById("eye-left");
const eyeRight = document.getElementById("eye-right");
const pupilLeft = document.getElementById("pupil-left");
const pupilRight = document.getElementById("pupil-right");
const armRight = document.getElementById("arm-right");
const bubble = document.getElementById("mascot-bubble");

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let lastNotice = 0;
let busy = false; // true while walking/dancing/jumping/reacting

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function setState(state) {
    mascot.classList.remove("idle", "walking", "dancing", "jumping");
    mascot.classList.add(state);
}

function showBubble(text, duration) {
    bubble.textContent = text;
    bubble.classList.add("show");
    setTimeout(() => bubble.classList.remove("show"), duration);
}

async function blink() {
    eyeLeft.classList.add("blinking");
    eyeRight.classList.add("blinking");
    await wait(220);
    eyeLeft.classList.remove("blinking");
    eyeRight.classList.remove("blinking");
}

function scheduleBlink() {
    setTimeout(async () => {
        await blink();
        scheduleBlink();
    }, rand(2000, 4500));
}

async function wave() {
    armRight.classList.add("waving");
    await wait(1500);
    armRight.classList.remove("waving");
}

function getBounds() {
    const margin = 16;
    const width = mascotWrap.offsetWidth || 70;
    return { min: margin, max: Math.max(margin, window.innerWidth - width - margin) };
}

async function walkTo(targetLeft, currentLeft) {
    const distance = Math.abs(targetLeft - currentLeft);
    const speed = 60; // px per second
    const duration = Math.max(0.6, distance / speed);
    mascotFlip.classList.toggle("facing-left", targetLeft < currentLeft);
    mascotWrap.style.transition = `left ${duration}s linear`;
    setState("walking");
    mascotWrap.style.left = targetLeft + "px";
    await wait(duration * 1000);
    setState("idle");
}

function scheduleMascotAction() {
    setTimeout(async () => {
        if (!busy) {
            busy = true;
            const roll = Math.random();
            if (roll < 0.4) {
                const bounds = getBounds();
                const current = parseFloat(mascotWrap.style.left) || 20;
                const target = rand(bounds.min, bounds.max);
                await walkTo(target, current);
            } else if (roll < 0.7) {
                setState("dancing");
                await wait(2200);
                setState("idle");
            } else if (roll < 0.9) {
                setState("jumping");
                await wait(800);
                setState("idle");
            } else {
                await wave();
            }
            busy = false;
        }
        scheduleMascotAction();
    }, rand(2500, 5000));
}

// --- Cursor interaction ---

function updatePupils() {
    const flipped = mascotFlip.classList.contains("facing-left");
    [ [eyeLeft, pupilLeft], [eyeRight, pupilRight] ].forEach(([eye, pupil]) => {
        const rect = eye.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = mouseX - cx;
        const dy = mouseY - cy;
        if (flipped) dx = -dx;
        const angle = Math.atan2(dy, dx);
        const radius = 4;
        const tx = Math.cos(angle) * radius;
        const ty = Math.sin(angle) * radius;
        pupil.style.transform = `translate(${tx}px, ${ty}px)`;
    });
}

async function noticeCursor() {
    if (busy) return;
    busy = true;
    const wrapRect = mascotWrap.getBoundingClientRect();
    const centerX = wrapRect.left + wrapRect.width / 2;
    mascotFlip.classList.toggle("facing-left", mouseX < centerX);
    await wave();
    busy = false;
}

function handlePointerMove(x, y) {
    mouseX = x;
    mouseY = y;
    updatePupils();

    const wrapRect = mascotWrap.getBoundingClientRect();
    const centerX = wrapRect.left + wrapRect.width / 2;
    const centerY = wrapRect.top + wrapRect.height / 2;
    const distance = Math.hypot(mouseX - centerX, mouseY - centerY);

    const now = Date.now();
    if (distance < 130 && now - lastNotice > 5000) {
        lastNotice = now;
        noticeCursor();
    }
}

document.addEventListener("mousemove", (e) => handlePointerMove(e.clientX, e.clientY));

mascot.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    mascot.classList.add("clicked");
    showBubble("Hi!", 1200);
    await wave();
    mascot.classList.remove("clicked");
    busy = false;
});

document.addEventListener("DOMContentLoaded", () => {
    mascotWrap.style.left = "20px";
    scheduleBlink();
    setInterval(updatePupils, 200); // keep pupils correct as mascot walks/flips
    setTimeout(async () => {
        await wave();
        scheduleMascotAction();
    }, 600);
});