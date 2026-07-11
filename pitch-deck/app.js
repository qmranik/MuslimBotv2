/* ==========================================================================
   liteERP Pitch Deck — Interactive Client Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const slides = Array.from(document.querySelectorAll('.slide-card'));
  const slidesNavList = document.getElementById('slides-nav-list');
  const slideSteppedIndicator = document.getElementById('slide-stepped-indicator');
  const currentSlideHeadingText = document.getElementById('current-slide-heading-text');

  const prevSlideBtn = document.getElementById('prev-slide-btn');
  const nextSlideBtn = document.getElementById('next-slide-btn');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
  const sidebar = document.querySelector('.sidebar-nav');

  let currentSlideIndex = 0;

  const slideTitles = slides.map((slide, i) => {
    return slide.getAttribute('data-title') || `Slide ${i + 1}`;
  });

  function initNavigation() {
    slidesNavList.innerHTML = '';
    slideSteppedIndicator.innerHTML = '';

    slideTitles.forEach((title, index) => {
      const navBtn = document.createElement('button');
      navBtn.className = `nav-item ${index === 0 ? 'active' : ''}`;
      navBtn.setAttribute('aria-label', `Go to Slide ${index + 1}: ${title}`);
      navBtn.innerHTML = `
        <span class="nav-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="nav-label">${title}</span>
      `;
      navBtn.addEventListener('click', () => goToSlide(index));
      slidesNavList.appendChild(navBtn);

      const dot = document.createElement('button');
      dot.className = `indicator-dot ${index === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Navigate to slide ${index + 1}`);
      dot.addEventListener('click', () => goToSlide(index));
      slideSteppedIndicator.appendChild(dot);
    });

    updateSlideControls();
  }

  function goToSlide(targetIndex) {
    if (targetIndex < 0 || targetIndex >= slides.length || targetIndex === currentSlideIndex) return;

    if (!document.startViewTransition) {
      executeSlideStateChange(targetIndex);
    } else {
      document.startViewTransition(() => {
        executeSlideStateChange(targetIndex);
      });
    }
  }

  function executeSlideStateChange(targetIndex) {
    slides[currentSlideIndex].classList.remove('active');
    slides[currentSlideIndex].setAttribute('tabindex', '-1');

    slides[targetIndex].classList.add('active');
    slides[targetIndex].setAttribute('tabindex', '0');

    const navItems = Array.from(slidesNavList.querySelectorAll('.nav-item'));
    navItems[currentSlideIndex].classList.remove('active');
    navItems[targetIndex].classList.add('active');

    const dots = Array.from(slideSteppedIndicator.querySelectorAll('.indicator-dot'));
    dots[currentSlideIndex].classList.remove('active');
    dots[targetIndex].classList.add('active');

    currentSlideIndex = targetIndex;
    currentSlideHeadingText.textContent = `Slide ${currentSlideIndex + 1}: ${slideTitles[currentSlideIndex]}`;

    updateSlideControls();
    slides[currentSlideIndex].focus();
  }

  function updateSlideControls() {
    prevSlideBtn.disabled = currentSlideIndex === 0;
    nextSlideBtn.disabled = currentSlideIndex === slides.length - 1;
  }

  prevSlideBtn.addEventListener('click', () => goToSlide(currentSlideIndex - 1));
  nextSlideBtn.addEventListener('click', () => goToSlide(currentSlideIndex + 1));

  document.querySelectorAll('.advance-slide-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentSlideIndex < slides.length - 1) {
        goToSlide(currentSlideIndex + 1);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        if (currentSlideIndex < slides.length - 1) goToSlide(currentSlideIndex + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        if (currentSlideIndex > 0) goToSlide(currentSlideIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        goToSlide(0);
        break;
      case 'End':
        e.preventDefault();
        goToSlide(slides.length - 1);
        break;
    }
  });

  toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  toggleFullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        toggleFullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
      }).catch(err => {
        console.warn(`Fullscreen error: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        toggleFullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
      });
    }
  });

  document.addEventListener('fullscreenchange', () => {
    toggleFullscreenBtn.innerHTML = document.fullscreenElement
      ? '<i class="fa-solid fa-compress"></i>'
      : '<i class="fa-solid fa-expand"></i>';
  });


  // --- Platform tabs (Punk Work pattern) ---
  const platformTabs = document.querySelectorAll('.platform-tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  platformTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');

      platformTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.getAttribute('data-panel') === target);
      });
    });
  });


  // --- Voice agent simulator ---
  const playVoiceSimBtn = document.getElementById('play-voice-sim-btn');
  const voiceSimTranscript = document.getElementById('voice-sim-transcript');
  const simVoiceIndicator = document.getElementById('sim-voice-indicator');

  let isVoiceSimRunning = false;
  let voiceSimTimer = null;

  const voiceConversation = [
    { speaker: 'operator', text: 'Muslimbot, check expiration compliance and stock alerts.' },
    { speaker: 'assistant', text: 'Running daily cron check... Expiration alert! Batch NAPA-5 (Napa 500mg) has 12 days left. Push notification sent to Chatwoot admin panel.' },
    { speaker: 'operator', text: 'Verify register camera connection and status.' },
    { speaker: 'assistant', text: 'Querying Frigate NVR... CAM_01 (Front Register) online. TLS 1.2 encrypted. Object detection active. No movement detected.' },
    { speaker: 'operator', text: 'Create POS order: 10 cases of Nano-Banana for Demo Client.' },
    { speaker: 'assistant', text: 'Processing voice-POS... Created Sales Invoice ACC-SINV-2026-00042 for 10 cases. Inventory adjusted. Total: $4,500.00.' }
  ];

  playVoiceSimBtn.addEventListener('click', () => {
    if (isVoiceSimRunning) return;

    isVoiceSimRunning = true;
    playVoiceSimBtn.disabled = true;
    playVoiceSimBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Calling AI...</span>';

    voiceSimTranscript.innerHTML = '';
    simVoiceIndicator.classList.add('animating');

    let dialogueIndex = 0;

    function playNextLine() {
      if (dialogueIndex >= voiceConversation.length) {
        simVoiceIndicator.classList.remove('animating');
        playVoiceSimBtn.disabled = false;
        playVoiceSimBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> <span>Replay query</span>';
        isVoiceSimRunning = false;
        return;
      }

      const line = voiceConversation[dialogueIndex];
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${line.speaker}`;

      const tag = line.speaker === 'operator' ? 'Operator' : 'Voice Agent (Gemini)';
      bubble.innerHTML = `
        <span class="bubble-tag">${tag}</span>
        <span class="bubble-txt"></span>
      `;

      voiceSimTranscript.appendChild(bubble);
      voiceSimTranscript.scrollTop = voiceSimTranscript.scrollHeight;

      const textSpan = bubble.querySelector('.bubble-txt');
      let charIndex = 0;

      function typeCharacter() {
        if (charIndex < line.text.length) {
          textSpan.textContent += line.text.charAt(charIndex);
          charIndex++;
          voiceSimTranscript.scrollTop = voiceSimTranscript.scrollHeight;
          voiceSimTimer = setTimeout(typeCharacter, 12);
        } else {
          dialogueIndex++;
          voiceSimTimer = setTimeout(playNextLine, line.speaker === 'operator' ? 1200 : 2500);
        }
      }

      typeCharacter();
    }

    voiceSimTimer = setTimeout(playNextLine, 1000);
  });


  // --- Generative UI demo ---
  const runGenuiBtn = document.getElementById('run-genui-demo-btn');
  const genuiTypedQuery = document.getElementById('genui-typed-query');
  const genuiOutputPanel = document.getElementById('genui-output-panel');

  const genuiDemoQuery = 'Show low-stock items and expiry alerts for this week';
  let genuiRunning = false;

  runGenuiBtn.addEventListener('click', () => {
    if (genuiRunning) return;
    genuiRunning = true;
    runGenuiBtn.disabled = true;
    genuiTypedQuery.textContent = '';
    genuiOutputPanel.innerHTML = '<div class="genui-placeholder"><i class="fa-solid fa-spinner fa-spin text-yellow"></i><p>Routing query via Gemini NLP...</p></div>';

    let charIdx = 0;
    function typeQuery() {
      if (charIdx < genuiDemoQuery.length) {
        genuiTypedQuery.textContent += genuiDemoQuery.charAt(charIdx);
        charIdx++;
        setTimeout(typeQuery, 30);
      } else {
        setTimeout(renderGenuiOutput, 800);
      }
    }
    typeQuery();
  });

  function renderGenuiOutput() {
    genuiOutputPanel.innerHTML = `
      <div class="genui-render-grid">
        <div class="genui-metric">
          <small>Low stock items</small>
          <strong class="text-red">3</strong>
        </div>
        <div class="genui-metric">
          <small>Expiry alerts (&lt;14d)</small>
          <strong class="text-yellow">2</strong>
        </div>
        <div class="genui-table">
          <table>
            <thead><tr><th>Item</th><th>Stock</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Savlon 100ml</td><td>8 units</td><td><span class="text-red">Low stock</span></td></tr>
              <tr><td>Napa 500mg</td><td>1,200</td><td><span class="text-yellow">12d expiry</span></td></tr>
              <tr><td>Nano-B Energy</td><td>40 cases</td><td><span class="text-green">OK</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="genui-action-row">
          <div class="genui-action-btn"><i class="fa-solid fa-cart-plus"></i> Reorder Savlon</div>
          <div class="genui-action-btn"><i class="fa-solid fa-bell"></i> Notify manager</div>
        </div>
      </div>
    `;
    runGenuiBtn.disabled = false;
    runGenuiBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Replay demo';
    genuiRunning = false;
  }


  // --- CCTV / NVR simulation ---
  const triggerMotionAlertBtn = document.getElementById('trigger-motion-alert-btn');
  const movementAlertToast = document.getElementById('movement-alert-toast');
  const closeAlertToastBtn = document.getElementById('close-alert-toast-btn');

  const cctvClock = document.getElementById('cctv-clock');
  const cctvNoise = document.getElementById('cctv-noise');
  const intruderMeshBox = document.getElementById('intruder-mesh-box');
  const survAlertLog = document.getElementById('surv-alert-log');
  const grafLogsScroll = document.getElementById('graf-logs-scroll');

  function updateCCTVTime() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    cctvClock.textContent = `${hrs}:${mins}:${secs}`;
  }

  setInterval(updateCCTVTime, 1000);
  updateCCTVTime();

  let isIntrusionSimActive = false;

  triggerMotionAlertBtn.addEventListener('click', () => {
    if (isIntrusionSimActive) return;

    isIntrusionSimActive = true;
    triggerMotionAlertBtn.disabled = true;
    triggerMotionAlertBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Running AI NVR...</span>';

    cctvNoise.classList.add('interference');

    setTimeout(() => {
      cctvNoise.classList.remove('interference');
      intruderMeshBox.classList.add('active');
      movementAlertToast.classList.add('visible');

      const localLog = document.createElement('div');
      localLog.className = 'log-entry alert';
      const now = new Date();
      const localTimeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
      localLog.innerHTML = `<span class="log-time">${localTimeStr}</span> ALARM: Person detected (87%). Clip saved. FTP upload complete.`;
      survAlertLog.appendChild(localLog);
      survAlertLog.scrollTop = survAlertLog.scrollHeight;

      const lokiLog = document.createElement('div');
      lokiLog.className = 'log-row alert';
      lokiLog.innerHTML = `<span class="l-t">${localTimeStr}</span> LOKI: Frigate alert register zone. Dispatching n8n SMS...`;
      grafLogsScroll.appendChild(lokiLog);
      grafLogsScroll.scrollTop = grafLogsScroll.scrollHeight;
    }, 800);
  });

  closeAlertToastBtn.addEventListener('click', () => {
    movementAlertToast.classList.remove('visible');
    intruderMeshBox.classList.remove('active');
    triggerMotionAlertBtn.disabled = false;
    triggerMotionAlertBtn.innerHTML = '<i class="fa-solid fa-video"></i> <span>Simulate NVR alert</span>';
    isIntrusionSimActive = false;
  });


  // --- SaaS calculator ---
  const tenantSlider = document.getElementById('tenant-count-slider');
  const priceSlider = document.getElementById('avg-price-slider');
  const infraSlider = document.getElementById('infra-cost-slider');

  const tenantLabel = document.getElementById('tenant-count-label');
  const priceLabel = document.getElementById('avg-price-label');
  const infraLabel = document.getElementById('infra-cost-label');

  const projectedMrrOutput = document.getElementById('projected-mrr');
  const grossMarginOutput = document.getElementById('gross-margin-pct');

  function calculateSaaSMargins() {
    const tenants = parseInt(tenantSlider.value);
    const price = parseInt(priceSlider.value);
    const infra = parseInt(infraSlider.value);

    tenantLabel.textContent = tenants;
    priceLabel.textContent = `$${price}`;
    infraLabel.textContent = `$${infra}`;

    const mrr = tenants * price;
    const grossProfit = mrr - infra;
    const marginPct = mrr > 0 ? (grossProfit / mrr) * 100 : 0;

    projectedMrrOutput.textContent = `$${mrr.toLocaleString('en-US')}`;
    grossMarginOutput.textContent = `${marginPct.toFixed(1)}%`;

    if (marginPct >= 90) {
      grossMarginOutput.className = 'result-val text-green';
    } else if (marginPct >= 70) {
      grossMarginOutput.className = 'result-val text-yellow';
    } else {
      grossMarginOutput.className = 'result-val text-red';
    }
  }

  tenantSlider.addEventListener('input', calculateSaaSMargins);
  priceSlider.addEventListener('input', calculateSaaSMargins);
  infraSlider.addEventListener('input', calculateSaaSMargins);

  const pitchCtaBtn = document.getElementById('pitch-cta-btn');
  pitchCtaBtn.addEventListener('click', () => {
    if (currentSlideIndex < slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  });

  initNavigation();
  calculateSaaSMargins();
});
