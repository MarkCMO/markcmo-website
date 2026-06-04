/* Zero Pay Benefits - landing interactivity: savings calculator + lead form */
(function () {
  'use strict';

  // ---- mobile nav ----
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    links.addEventListener('click', function (e) { if (e.target.tagName === 'A') links.classList.remove('open'); });
  }

  // ---- savings calculator ----
  var emp = document.getElementById('empCount');
  var per = document.getElementById('perEmp');
  var out = document.getElementById('calcOut');
  var monthly = document.getElementById('calcMonthly');

  function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  function recalc() {
    if (!emp || !per || !out) return;
    var count = Math.max(0, Math.min(parseInt(emp.value, 10) || 0, 100000));
    var rate = parseFloat(per.value) || 640;
    var annual = count * rate;
    out.textContent = fmt(annual);
    if (monthly) {
      monthly.textContent = annual > 0
        ? 'About ' + fmt(annual / 12) + ' per month back to your bottom line'
        : 'Enter your headcount to see the estimate';
    }
  }
  if (emp) emp.addEventListener('input', recalc);
  if (per) per.addEventListener('change', recalc);
  recalc();

  // ---- lead form ----
  var form = document.getElementById('leadForm');
  if (!form) return;
  var msg = document.getElementById('formMsg');
  var btn = document.getElementById('leadSubmit');

  function showMsg(text, kind) {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'form-msg ' + kind;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showMsg('', '');

    // honeypot: silently succeed for bots
    var hp = document.getElementById('website');
    if (hp && hp.value.trim() !== '') { window.location.href = 'thank-you.html'; return; }

    var data = {
      firstName: val('firstName'),
      lastName: val('lastName'),
      company: val('company'),
      email: val('email'),
      phone: val('phone'),
      employees: val('employees'),
      orgType: val('orgType'),
      message: val('message'),
      estimate: out ? out.textContent : '',
      source: 'ehp-program landing',
      pageUrl: window.location.href
    };

    if (!data.firstName || !data.lastName || !data.company || !data.email || !data.employees) {
      showMsg('Please complete the required fields.', 'err');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showMsg('Please enter a valid work email.', 'err');
      return;
    }

    btn.disabled = true;
    var original = btn.innerHTML;
    btn.innerHTML = 'Sending...';

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          window.location.href = 'thank-you.html';
        } else {
          showMsg((res.j && res.j.error) || 'Something went wrong. Please email us or try again.', 'err');
          btn.disabled = false; btn.innerHTML = original;
        }
      })
      .catch(function () {
        showMsg('Network error. Please try again or email us directly.', 'err');
        btn.disabled = false; btn.innerHTML = original;
      });
  });

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }
})();
