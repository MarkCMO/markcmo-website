// ═══════════════════════════════════════════════════════════════
// MarkCMO Form Engine v3 - Sign & Hold for Countersignature
// Flow: fill → sign → PDF generated in browser → POST to Netlify
//       function → Mark gets email to countersign → both get PDF
// ═══════════════════════════════════════════════════════════════
const { PDFDocument, rgb, StandardFonts } = PDFLib;

// ─── Inject shared form + signature pad styles ──────────────────
function injectFormStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .doc-form-wrap{max-width:680px;margin:0 auto;padding:2.5rem 1.5rem 5rem}
    .doc-form-wrap h2{font-family:'Barlow Condensed',sans-serif;font-size:1.6rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold,#C6A654);margin:0 0 .25rem}
    .form-intro{color:#aaa;font-size:.82rem;letter-spacing:.04em;margin-bottom:2rem;line-height:1.6}
    .form-section{margin-bottom:2rem}
    .form-section-label{font-family:'Barlow Condensed',sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--gold,#C6A654);border-bottom:1px solid rgba(198,166,84,.25);padding-bottom:.4rem;margin-bottom:1.2rem}
    .form-row{margin-bottom:1.1rem}
    .form-row label{display:block;font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:.35rem}
    .form-row input,.form-row select,.form-row textarea{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:3px;color:#f0f0f0;font-family:'Barlow',sans-serif;font-size:.9rem;padding:.65rem .85rem;outline:none;transition:border-color .2s;box-sizing:border-box}
    .form-row input:focus,.form-row select:focus,.form-row textarea:focus{border-color:var(--gold,#C6A654)}
    .form-row textarea{resize:vertical;min-height:80px}
    .form-row select option{background:#111;color:#f0f0f0}
    .form-hint{font-size:.72rem;color:#666;margin-top:.3rem;font-style:italic}
    .required-note{font-size:.72rem;color:#666;margin-bottom:1.5rem;font-style:italic}

    /* ── Signature Section ───────────────────────────── */
    .sig-section{margin-top:2.5rem;border-top:1px solid rgba(255,255,255,.06);padding-top:2rem}
    .sig-section-title{font-family:'Barlow Condensed',sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--gold,#C6A654);margin-bottom:.6rem}
    .sig-section-intro{font-size:.8rem;color:#666;line-height:1.6;margin-bottom:1.2rem}
    .sig-name-preview{font-family:'Dancing Script',cursive,'Barlow',sans-serif;font-size:1.5rem;color:var(--gold,#C6A654);min-height:2rem;margin-bottom:.75rem;letter-spacing:.02em}
    .sig-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.08)}
    .sig-tab{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;padding:.55rem 1.1rem;cursor:pointer;color:#555;border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;transition:color .2s,border-color .2s;font-family:'Barlow',sans-serif}
    .sig-tab.active{color:var(--gold,#C6A654);border-bottom-color:var(--gold,#C6A654)}
    .sig-canvas-wrap{background:#080808;border:1px solid rgba(255,255,255,.08);border-top:none;border-radius:0 0 3px 3px;height:130px;position:relative}
    canvas#client-sig-canvas{width:100%;height:100%;touch-action:none;cursor:crosshair;display:block}
    .sig-type-wrap{display:none;height:130px;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08);border-top:none;background:#080808;border-radius:0 0 3px 3px}
    .sig-type-wrap.visible{display:flex}
    .sig-type-preview{font-family:'Dancing Script',cursive;font-size:2.2rem;color:var(--gold,#C6A654);text-align:center}
    .sig-actions{display:flex;gap:.5rem;margin-top:.5rem}
    .sig-clear-btn{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:#555;background:none;border:1px solid #2a2a2a;border-radius:2px;padding:.35rem .85rem;cursor:pointer;transition:color .2s}
    .sig-clear-btn:hover{color:#999}
    .sig-hint{font-size:.72rem;color:#444;margin-top:.5rem;font-style:italic}
    .sig-legal{font-size:.72rem;color:#444;line-height:1.6;margin-top:1rem;padding:1rem;background:rgba(255,255,255,.02);border-radius:2px;border:1px solid rgba(255,255,255,.05)}
    .sig-legal strong{color:#666}

    /* ── Submit Button ───────────────────────────────── */
    #generate-btn{display:block;width:100%;background:var(--gold,#C6A654);color:#000;border:none;border-radius:3px;font-family:'Barlow',sans-serif;font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:1.1rem 2rem;cursor:pointer;transition:opacity .2s,transform .1s;margin-top:1.75rem}
    #generate-btn:hover{opacity:.88}
    #generate-btn:active{transform:scale(.99)}
    #generate-btn:disabled{opacity:.4;cursor:not-allowed}

    /* ── Status ──────────────────────────────────────── */
    .form-status{margin-top:1.2rem;padding:.85rem 1rem;border-radius:3px;font-size:.83rem;line-height:1.7;display:none}
    .form-status.loading{display:block;background:rgba(198,166,84,.08);color:var(--gold,#C6A654)}
    .form-status.success{display:block;background:rgba(0,180,80,.1);color:#5dce8a;border:1px solid rgba(0,180,80,.2)}
    .form-status.error{display:block;background:rgba(220,50,50,.1);color:#f07070;border:1px solid rgba(220,50,50,.2)}

    @media(max-width:600px){.doc-form-wrap{padding:1.5rem 1rem 3rem}}
  `;
  document.head.appendChild(s);

  // Load Dancing Script for typed sig
  if (!document.querySelector('link[href*="Dancing+Script"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap';
    document.head.appendChild(l);
  }
}

// ─── Render the signature pad HTML into the form ────────────────
function initSigPad(clientNameFieldId = 'client_name') {
  const wrap = document.getElementById('generate-btn').parentElement;
  const sigHtml = `
  <div class="sig-section">
    <div class="sig-section-title">Electronic Signature</div>
    <div class="sig-section-intro">By signing below you agree that your electronic signature is legally binding under the U.S. ESIGN Act.</div>
    <div class="sig-tabs">
      <button class="sig-tab active" onclick="switchSigMode('draw')">Draw</button>
      <button class="sig-tab" onclick="switchSigMode('type')">Type</button>
    </div>
    <div class="sig-canvas-wrap" id="client-draw-wrap">
      <canvas id="client-sig-canvas"></canvas>
    </div>
    <div class="sig-type-wrap" id="client-type-wrap">
      <div class="sig-type-preview" id="client-typed-sig">Your Name</div>
    </div>
    <div class="sig-actions">
      <button class="sig-clear-btn" onclick="clearClientSig()">Clear</button>
    </div>
    <div class="sig-hint">Draw with mouse or finger. Or switch to "Type" to sign with your name.</div>
    <div class="sig-legal">
      <strong>By clicking "Sign &amp; Submit"</strong> you confirm: (1) You have read and agree to the terms above. (2) Your electronic signature is intended as your legal signature. (3) You consent to electronic delivery of the executed document. &nbsp;-&nbsp; IP and timestamp will be logged.
    </div>
  </div>`;

  const btn = document.getElementById('generate-btn');
  btn.insertAdjacentHTML('beforebegin', sigHtml);
  btn.textContent = '✍ Sign & Submit for Countersignature';

  // Init canvas
  const canvas = document.getElementById('client-sig-canvas');
  const ctx = canvas.getContext('2d');
  let drawing = false, lx = 0, ly = 0;

  window._clientSigMode = 'draw';
  window._clientHasSig = false;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.parentElement.offsetWidth * dpr;
    canvas.height = canvas.parentElement.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#C6A654';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  resize();
  window.addEventListener('resize', resize);

  function pt(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  canvas.addEventListener('mousedown', e => { drawing = true; [lx, ly] = pt(e); window._clientHasSig = true; });
  canvas.addEventListener('mousemove', e => { if (!drawing) return; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(...pt(e)); ctx.stroke(); [lx, ly] = pt(e); });
  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('mouseleave', () => drawing = false);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; [lx, ly] = pt(e.touches[0]); window._clientHasSig = true; }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!drawing) return; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(...pt(e.touches[0])); ctx.stroke(); [lx, ly] = pt(e.touches[0]); }, { passive: false });
  canvas.addEventListener('touchend', () => drawing = false);

  // Update typed sig preview when name field changes
  const nameField = document.getElementById(clientNameFieldId);
  if (nameField) {
    nameField.addEventListener('input', () => {
      const el = document.getElementById('client-typed-sig');
      if (el) el.textContent = nameField.value || 'Your Name';
    });
  }
}

window.clearClientSig = function () {
  const canvas = document.getElementById('client-sig-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  window._clientHasSig = false;
};

window.switchSigMode = function (m) {
  window._clientSigMode = m;
  document.querySelectorAll('.sig-tab').forEach((t, i) => t.classList.toggle('active', (i === 0) === (m === 'draw')));
  document.getElementById('client-draw-wrap').style.display = m === 'draw' ? 'block' : 'none';
  document.getElementById('client-type-wrap').classList.toggle('visible', m === 'type');
  window._clientHasSig = m === 'type';
};

// ─── Get client sig as data URL ─────────────────────────────────
function getClientSigDataURL(clientName) {
  if (window._clientSigMode === 'type') {
    const oc = document.createElement('canvas');
    oc.width = 400; oc.height = 100;
    const c = oc.getContext('2d');
    c.font = 'bold 48px "Dancing Script", cursive';
    c.fillStyle = '#C6A654';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(clientName || 'Signature', 200, 50);
    return oc.toDataURL('image/png');
  }
  return document.getElementById('client-sig-canvas').toDataURL('image/png');
}

// ─── Core: fill PDF + embed sig + POST to Netlify ───────────────
async function fillAndSubmit({ pdfPath, textFields, sigPage, sigX, sigY, sigW, sigH,
  clientNameY, clientTitleY, clientDateY, clientCompany, effectiveDate,
  markSigPage, markSigY, markNameY, markTitleY, markDateY,
  docName, docId, filename, clientName, clientEmail, formFields }) {
  const statusEl = document.getElementById('form-status');
  const btn = document.getElementById('generate-btn');

  // Validate sig
  if (!window._clientHasSig && window._clientSigMode === 'draw') {
    statusEl.textContent = 'Please draw or type your signature before submitting.';
    statusEl.className = 'form-status error';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Generating document…';
  statusEl.textContent = 'Building your signed PDF…';
  statusEl.className = 'form-status loading';

  try {
    // 1. Load template
    const res = await fetch(pdfPath);
    if (!res.ok) throw new Error('Could not load document template.');
    const bytes = await res.arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    // 2. Fill text fields
    for (const f of textFields) {
      if (!f.value || !f.value.trim()) continue;
      const pg = pages[f.page - 1];
      if (!pg) continue;
      pg.drawText(f.value.trim(), { x: f.x, y: f.y + 2, size: f.size || 10, font, color: rgb(0.1, 0.1, 0.1), maxWidth: f.maxWidth || 380, lineHeight: 14 });
    }

    // 3. Embed client signature + fill ALL signature page fields
    const sigDataUrl = getClientSigDataURL(clientName);
    const sigPngBytes = Uint8Array.from(atob(sigDataUrl.split(',')[1]), c => c.charCodeAt(0));
    const sigImg = await pdfDoc.embedPng(sigPngBytes);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const sigPg = pages[(sigPage || pages.length) - 1];
    const sigPageH = sigPg.getSize().height;

    // Client signature image
    sigPg.drawImage(sigImg, { x: sigX || 63, y: sigY || 80, width: sigW || 200, height: sigH || 30, opacity: 0.9 });

    // Client printed name (above "Printed Name" label)
    if (clientNameY) sigPg.drawText(clientName || '', {
      x: sigX || 63, y: clientNameY, size: 10, font, color: rgb(0.1, 0.1, 0.1), maxWidth: 220
    });
    // Client title/company (above "Title / Company" label)
    if (clientTitleY) sigPg.drawText(clientCompany || '', {
      x: sigX || 63, y: clientTitleY, size: 10, font, color: rgb(0.1, 0.1, 0.1), maxWidth: 220
    });
    // Client date (above "Date" label)
    if (clientDateY) sigPg.drawText(effectiveDate || new Date().toLocaleDateString('en-US', {dateStyle:'long'}), {
      x: sigX || 63, y: clientDateY, size: 10, font, color: rgb(0.1, 0.1, 0.1), maxWidth: 180
    });
    // Electronic signature timestamp (small, below date)
    sigPg.drawText('Signed: ' + new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' }) + ' ET', {
      x: sigX || 63, y: (clientDateY || sigY || 80) - 15, size: 7, font, color: rgb(0.4, 0.4, 0.4)
    });

    // 5. Convert to base64
    const pdfBytes = await pdfDoc.save();
    // Chunked base64 encode - avoids stack overflow on large PDFs
    let pdfBase64 = '';
    const chunk = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunk) {
      pdfBase64 += String.fromCharCode(...pdfBytes.slice(i, i + chunk));
    }
    pdfBase64 = btoa(pdfBase64);

    btn.textContent = 'Submitting…';
    statusEl.textContent = 'Uploading signed document…';

    // 6. POST to Netlify function
    const submitRes = await fetch('/.netlify/functions/submit-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docName, docId, filename,
        fields: formFields,
        pdfBase64,
        clientName,
        clientEmail,
        clientSigBase64: sigDataUrl.split(',')[1],
        markSig: { page: markSigPage || null, sigY: markSigY || null, nameY: markNameY || null, titleY: markTitleY || null, dateY: markDateY || null },
      }),
    });

    let result;
    try { result = await submitRes.json(); } catch(e) { result = {}; }
    if (!submitRes.ok) throw new Error(result.error || `Server error ${submitRes.status}`);

    // 7. Success
    statusEl.innerHTML = `
      <strong style="display:block;font-size:1rem;margin-bottom:.5rem;">✅ Document Submitted Successfully</strong>
      <strong>${docName}</strong> has been signed and is now awaiting Mark's countersignature.<br/>
      Mark will review and countersign within 24 hours.<br/>
      <strong>Both you and Mark will receive the fully executed document by email</strong> once it's countersigned.<br/>
      <span style="color:#3a9a60;font-size:.78rem;display:block;margin-top:.6rem;">Confirmation sent to ${clientEmail}</span>`;
    statusEl.className = 'form-status success';
    btn.textContent = '✅ Submitted - Awaiting Countersignature';
    btn.style.opacity = '0.4';

  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.className = 'form-status error';
    btn.disabled = false;
    btn.textContent = '✍ Sign & Submit for Countersignature';
  }
}

// ─── Simple PDF fill + download (no signature, no submission) ──
// Used by Proposal which is Mark's document, not a client contract
async function downloadFilledPDF(pdfPath, textFields, outputFilename) {
  const statusEl = document.getElementById('form-status');
  const btn = document.getElementById('generate-btn');
  btn.disabled = true; btn.textContent = 'Generating PDF…';
  if (statusEl) { statusEl.textContent = 'Building your PDF…'; statusEl.className = 'form-status loading'; }
  try {
    const res = await fetch(pdfPath);
    if (!res.ok) throw new Error('Could not load PDF template.');
    const pdfDoc = await PDFDocument.load(await res.arrayBuffer());
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    for (const f of textFields) {
      if (!f.value || !f.value.trim()) continue;
      const pg = pages[f.page - 1]; if (!pg) continue;
      pg.drawText(f.value.trim(), { x: f.x, y: f.y + 2, size: f.size || 10, font, color: rgb(0.1, 0.1, 0.1), maxWidth: f.maxWidth || 380, lineHeight: 14 });
    }
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = outputFilename; a.click();
    URL.revokeObjectURL(url);
    if (statusEl) {
      statusEl.innerHTML = '<strong>✅ Proposal Downloaded</strong><br/>Your filled proposal has been saved to your device.';
      statusEl.className = 'form-status success';
    }
    btn.textContent = '✅ Downloaded - Generate Again'; btn.disabled = false;
  } catch (err) {
    if (statusEl) { statusEl.textContent = 'Error: ' + err.message; statusEl.className = 'form-status error'; }
    btn.textContent = 'Try Again'; btn.disabled = false;
  }
}
