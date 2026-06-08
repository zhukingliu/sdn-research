/**
 * SDN Research — Tech Theme
 * Particle network · Navigation · Interactions
 */

document.addEventListener('DOMContentLoaded', () => {

  // ============ Particle Network Canvas ============
  const canvas = document.getElementById('particle-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animFrame;
    let mouseX = -1000;
    let mouseY = -1000;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const PARTICLE_COUNT = 70;
    const CONNECT_DIST = 140;
    const MOUSE_DIST = 180;

    class Particle {
      constructor() {
        this.reset();
        this.y = Math.random() * canvas.height; // start distributed
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 1.8 + 0.8;
        this.opacity = Math.random() * 0.5 + 0.2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < -50) this.x = canvas.width + 50;
        if (this.x > canvas.width + 50) this.x = -50;
        if (this.y < -50) this.y = canvas.height + 50;
        if (this.y > canvas.height + 50) this.y = -50;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 200, 255, ${this.opacity})`;
        ctx.fill();
      }
    }

    // init
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // update & draw particles
      for (const p of particles) {
        p.update();
        p.draw();
      }

      // draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 180, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // mouse interaction
      if (mouseX > 0 && mouseY > 0) {
        for (const p of particles) {
          const dx = p.x - mouseX;
          const dy = p.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_DIST) {
            const alpha = (1 - dist / MOUSE_DIST) * 0.35;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseX, mouseY);
            ctx.strokeStyle = `rgba(0, 220, 255, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
            // subtle pull toward mouse
            p.vx += (dx / dist) * 0.02;
            p.vy += (dy / dist) * 0.02;
          }
        }
      }

      animFrame = requestAnimationFrame(animate);
    }

    animate();

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    document.addEventListener('mouseleave', () => {
      mouseX = -1000;
      mouseY = -1000;
    });
  }

  // ============ Active Navigation Tracking ============
  const sections = document.querySelectorAll('section[id], [data-section]');
  const navLinks = document.querySelectorAll('.nav-link');

  function updateActiveNav() {
    let current = '';
    const scrollY = window.scrollY + 120;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollY >= top && scrollY < top + height) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });

  // ============ Mobile Sidebar Toggle ============
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.querySelector('.sidebar-toggle');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // close sidebar on nav click (mobile)
    sidebar.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
        }
      });
    });

    // close sidebar on overlay click
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 &&
          sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          e.target !== toggleBtn) {
        sidebar.classList.remove('open');
      }
    });
  }

  // ============ Back to Top ============
  const backBtn = document.querySelector('.back-to-top');

  if (backBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 600) {
        backBtn.classList.add('visible');
      } else {
        backBtn.classList.remove('visible');
      }
    }, { passive: true });

    backBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ============ Typewriter effect ============
  const typeTarget = document.querySelector('[data-typewriter]');
  if (typeTarget) {
    const words = JSON.parse(typeTarget.getAttribute('data-typewriter'));
    let wordIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let typeSpeed = 100;

    function typeLoop() {
      const current = words[wordIdx];
      if (isDeleting) {
        typeTarget.textContent = current.substring(0, charIdx - 1);
        charIdx--;
        typeSpeed = 40;
      } else {
        typeTarget.textContent = current.substring(0, charIdx + 1);
        charIdx++;
        typeSpeed = 90;
      }

      if (!isDeleting && charIdx === current.length) {
        typeSpeed = 2000;
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        wordIdx = (wordIdx + 1) % words.length;
        typeSpeed = 400;
      }

      setTimeout(typeLoop, typeSpeed);
    }
    typeLoop();
  }

  // ============ Scroll reveal ============
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach((el) => revealObserver.observe(el));

  // ============ Copy code blocks ============
  document.querySelectorAll('.terminal').forEach((term) => {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.title = 'Copy';
    copyBtn.style.cssText = `
      position: absolute; top: 8px; right: 12px;
      background: none; border: 1px solid rgba(0,200,255,0.15);
      color: var(--text-muted); cursor: pointer;
      border-radius: 4px; padding: 2px 6px; font-size: 12px;
      transition: all 0.2s;
    `;
    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.borderColor = 'rgba(0,200,255,0.5)';
      copyBtn.style.color = 'var(--accent-cyan)';
    });
    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.borderColor = 'rgba(0,200,255,0.15)';
      copyBtn.style.color = 'var(--text-muted)';
    });
    copyBtn.addEventListener('click', () => {
      const body = term.querySelector('.terminal-body');
      if (body) {
        navigator.clipboard.writeText(body.textContent).then(() => {
          copyBtn.innerHTML = '✓';
          setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1500);
        });
      }
    });
    if (!term.style.position) term.style.position = 'relative';
    term.appendChild(copyBtn);
  });

});
