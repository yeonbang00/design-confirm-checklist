/* AdCheck reveal motions — 정적 HTML용 (의존성 없음)
 *
 * 사용법
 *   1) 이 파일을 프로젝트에 복사: /public/adcheck-reveal.js
 *   2) </body> 직전에: <script src="/adcheck-reveal.js"></script>
 *   3) 마크업에 속성만 추가:
 *
 *      좌 → 우 (카테고리 진입 시 옆에서 나오는 동작)
 *        <div data-stagger>
 *          <div data-row>...</div>
 *          <div data-row>...</div>
 *        </div>
 *
 *      위 → 아래 (기획안 헬퍼처럼 차르륵)
 *        <div data-stagger="down">
 *          <div data-row>...</div>
 *        </div>
 *
 *      단일 블록 페이드업
 *        <section data-reveal>...</section>
 *
 *   4) 페이지를 SPA처럼 전환한다면 전환 후 window.adcheckReveal() 호출.
 *      (일반 링크 이동 방식이면 아무것도 안 해도 됩니다.)
 */
(function () {
  var STEP = 52;          // 항목 간 시간차(ms)
  var DIST = 40;          // 좌→우 이동 거리(px)
  var DIST_DOWN = 22;     // 위→아래 이동 거리(px)
  var EASE = 'cubic-bezier(.16,1,.3,1)';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

  function prep(el, dir) {
    if (el.dataset.revealPrepped) return;
    el.dataset.revealPrepped = '1';
    if (reduce) return;
    el.style.opacity = '0';
    el.style.transform = dir === 'down'
      ? 'translateY(-' + DIST_DOWN + 'px)'
      : 'translateX(-' + DIST + 'px)';
    el.style.transition = 'opacity .7s ease, transform .8s ' + EASE;
  }

  function show(el) {
    el.style.opacity = '1';
    el.style.transform = 'none';
  }

  function fire(group) {
    var dir = group.getAttribute('data-stagger') === 'down' ? 'down' : 'left';
    var rows = group.querySelectorAll('[data-row]');
    for (var i = 0; i < rows.length; i++) {
      (function (row, i) {
        setTimeout(function () { show(row); }, i * STEP);
      })(rows[i], i);
    }
  }

  var groupIO, revealIO;

  function init() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-row],[data-reveal]').forEach(show);
      return;
    }

    if (!groupIO) {
      groupIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          fire(e.target);
          groupIO.unobserve(e.target);
        });
      }, {threshold: 0.01});
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          show(e.target);
          revealIO.unobserve(e.target);
        });
      }, {threshold: 0.06});
    }

    // 1단계: 대상 전부를 먼저 숨김 상태로 만든다 (아직 관찰·발화는 하지 않음)
    var staggerGroups = document.querySelectorAll('[data-stagger]');
    staggerGroups.forEach(function (group) {
      var dir = group.getAttribute('data-stagger') === 'down' ? 'down' : 'left';
      group.querySelectorAll('[data-row]').forEach(function (r) { prep(r, dir); });
    });
    var revealEls = document.querySelectorAll('[data-reveal]');
    revealEls.forEach(function (el) {
      if (el.dataset.revealBound || reduce) return;
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity .8s ease, transform .8s cubic-bezier(.2,.8,.2,1)';
    });

    // 2단계: 프레임을 하나 넘겨 브라우저가 숨김 상태를 한 번 그리게 한 뒤에야
    // 관찰을 시작하거나 화면 안 항목을 발화한다 — 이 틈이 없으면 opacity:0→1
    // 전환이 같은 틱에서 합쳐져 트랜지션 없이 툭 튀어 보인다("잠깐 움찔").
    requestAnimationFrame(function () {
      staggerGroups.forEach(function (group) {
        if (group.dataset.staggerBound) return;
        group.dataset.staggerBound = '1';
        if (group.getBoundingClientRect().top < innerHeight * 1.2) { fire(group); return; }
        groupIO.observe(group);
      });
      revealEls.forEach(function (el) {
        if (el.dataset.revealBound) return;
        el.dataset.revealBound = '1';
        revealIO.observe(el);
      });
    });

    // 안전장치: 어떤 이유로든 트리거되지 않은 요소를 1.4초 후 강제 표시
    clearTimeout(init._t);
    init._t = setTimeout(function () {
      document.querySelectorAll('[data-row],[data-reveal]').forEach(show);
    }, 1400);
  }

  window.adcheckReveal = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
